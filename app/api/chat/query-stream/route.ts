/**
 * Streaming RAG Query API with LangChain
 * 
 * POST /api/chat/query-stream
 * 
 * Complete RAG pipeline with streaming LLM response:
 * 1. Hybrid search (vector + BM25) with 384-dim query embedding
 * 2. Build context from retrieved chunks
 * 3. Stream LLM response with RAG context
 * 4. Save messages to database
 * 5. Return SSE stream with sources
 */

import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createModelWithHealing, ModelPresets } from '@/lib/ai';
import { calculateConfidenceScore } from '@/lib/nlp/confidence-score';
import { buildStructuredMemory, formatStructuredMemoryForPrompt } from '@/lib/nlp/structured-memory';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';
import { cacheEmbedding } from '@/lib/embeddings/cache';
import { generateQueryEmbedding } from '@/lib/embeddings/query';

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SearchResult {
  chunk_id: string;
  document_id: string;
  chunk_text: string;
  similarity: number;
  title: string;
  source_url: string | null;
  document_type: string;
  chunk_index: number;
  trust_level?: number;
  vector_score?: number;
  bm25_score?: number;
  hybrid_score?: number;
  search_strategy?: string;
  rerank_score?: number;
}

const recentRequestSignatures = new Map<string, number>();

function cleanupRecentSignatures(now: number, windowMs: number) {
  for (const [key, timestamp] of recentRequestSignatures.entries()) {
    if (now - timestamp > windowMs) {
      recentRequestSignatures.delete(key);
    }
  }
}

function buildRequestSignature(input: {
  conversationId: string;
  query: string;
  originalQuery?: string;
  modelMode?: string;
}) {
  return [
    input.conversationId,
    input.modelMode || '',
    input.originalQuery || '',
    input.query
  ].join('|');
}

function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.min(1, Math.max(0, score));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denom) return 0;
  return dot / denom;
}

export async function POST(request: NextRequest) {
  const requestId = `api-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  console.log(`[RAG Stream] ========== NEW REQUEST - RequestID: ${requestId} ==========`);
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const supabase = await createClient();

        // Helper to send SSE events
        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        // Allow guest users (no authentication) to make ONE query
        // For authenticated users, check if they exist
        if (authError && authError.message !== 'Auth session missing!') {
          // Real auth error (not just missing session)
          sendEvent('error', { error: 'Authentication error' });
          controller.close();
          return;
        }
        
        const isGuest = !user;
        console.log(`[RAG Stream] RequestID: ${requestId} - User type: ${isGuest ? 'GUEST' : 'AUTHENTICATED'}`);
        
        if (isGuest) {
          console.log(`[RAG Stream] RequestID: ${requestId} - Processing guest query (no usage tracking)`);
          
          // Rate limiting for guest users - STRICT: 1 query per hour per IP
          const clientIP = getClientIP(request);
          const rateLimitResult = checkRateLimit(
            `guest-query:${clientIP}`,
            RATE_LIMITS.GUEST_QUERY
          );

          if (!rateLimitResult.allowed) {
            const resetDate = new Date(rateLimitResult.resetTime);
            const minutesUntilReset = Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000);
            console.log(`[RAG Stream] RequestID: ${requestId} - Rate limit exceeded for IP ${clientIP}`);
            sendEvent('error', { 
              error: `You've used your free query. Please sign in to continue or try again in ${minutesUntilReset} minutes.`,
              resetTime: resetDate.toISOString()
            });
            controller.close();
            return;
          }

          console.log(`[RAG Stream] RequestID: ${requestId} - Guest rate limit: ${rateLimitResult.remaining} remaining`);
        }

        // Get request body
        const body = await request.json();
        const {
          conversation_id,
          query,
          query_embedding: providedEmbedding,
          active_folders = null,
          model_mode = 'standard',
          original_query, // Original user input (for display), if different from optimized query
          query_language,
        } = body;

        console.log(`[RAG Stream] RequestID: ${requestId} - Received request for conversation: ${conversation_id}`);
        console.log(`[RAG Stream] RequestID: ${requestId} - Query: "${String(query || '').substring(0, 100)}..."`);
        if (original_query && original_query !== query) {
          console.log(`[RAG Stream] RequestID: ${requestId} - Original Query: "${String(original_query).substring(0, 100)}..."`);
        }
        console.log(`[RAG Stream] RequestID: ${requestId} - Model mode: ${model_mode}`);

        const signatureWindowMs = 5000;
        const now = Date.now();
        cleanupRecentSignatures(now, signatureWindowMs);
        const signature = buildRequestSignature({
          conversationId: conversation_id,
          query,
          originalQuery: original_query,
          modelMode: model_mode
        });
        const lastSeen = recentRequestSignatures.get(signature);
        if (lastSeen) {
          console.warn(`[RAG Stream] RequestID: ${requestId} - Duplicate request detected within ${signatureWindowMs}ms`);
        }
        recentRequestSignatures.set(signature, now);

        if (!conversation_id || !query) {
          sendEvent('error', { error: 'conversation_id and query are required' });
          controller.close();
          return;
        }

        // Use original_query for display if provided, otherwise use query
        const displayQuery = original_query || query;

        console.log(`[RAG Stream] RequestID: ${requestId} - Starting streaming RAG pipeline...`);
        console.log(`[RAG Stream] RequestID: ${requestId} - Display Query: ${displayQuery.substring(0, 100)}...`);
        console.log(`[RAG Stream] RequestID: ${requestId} - Optimized Query: ${query.substring(0, 100)}...`);
        sendEvent('status', { step: 'started', message: 'Starting RAG pipeline...' });

        // Check if this is a guest conversation (temporary ID)
        const isGuestConversation = conversation_id.startsWith('guest-');
        
        let userMessage = null;
        
        if (!isGuestConversation) {
          // Step 1: Save user message with DISPLAY query (original user input)
          sendEvent('status', { step: 'saving_user_message', message: 'Saving your message...' });
          const { data: savedUserMessage, error: userMsgError } = await supabase
            .from('chat_messages')
            .insert({
              conversation_id,
              role: 'user',
              content: displayQuery  // Use original query for display
            })
            .select()
            .single();

          if (userMsgError || !savedUserMessage) {
            console.error(`[RAG Stream] RequestID: ${requestId} - Failed to save user message:`, userMsgError);
            sendEvent('error', { error: 'Failed to save user message' });
            controller.close();
            return;
          }
          
          userMessage = savedUserMessage;
        } else {
          // Guest user: create temporary message object with DISPLAY query (not saved to DB)
          console.log(`[RAG Stream] RequestID: ${requestId} - Guest conversation, not saving user message to DB`);
          userMessage = {
            id: `guest-msg-${Date.now()}`,
            conversation_id,
            role: 'user',
            content: displayQuery,  // Use original query for display
            created_at: new Date().toISOString()
          };
        }

        sendEvent('user_message', { message: userMessage });

        // Step 2: Hybrid search using provided embedding or generate server-side
        // Note: Client should provide embedding after checking cache and generating locally
        sendEvent('status', { step: 'searching', message: 'Searching knowledge base...' });
        
        let searchResults = null;
        let queryEmbedding: number[] | null = null;
        if (user || isGuest) {
          // Use provided embedding, or generate server-side as last resort
          queryEmbedding = providedEmbedding;
          if (queryEmbedding && queryEmbedding.length > 0) {
            console.log(`[RAG Stream] RequestID: ${requestId} - Client embedding provided (${queryEmbedding.length}-dim)`);
          }
          
          // Only generate server-side if client didn't provide embedding (empty array or null)
          if (!queryEmbedding || queryEmbedding.length === 0) {
            console.log(`[RAG Stream] RequestID: ${requestId} - No embedding provided, generating server-side...`);
            sendEvent('status', { step: 'generating_embedding', message: 'Generating query embedding...' });
            
            try {
              // Use 'query' task for search queries (adds "query: " prefix)
              queryEmbedding = await generateQueryEmbedding(query, 'query');
              console.log(`[RAG Stream] RequestID: ${requestId} - ✅ Generated ${queryEmbedding.length}-dim embedding server-side`);
              
              // Cache the newly generated embedding for future use (only for authenticated users)
              if (user) {
                await cacheEmbedding(query, queryEmbedding);
                console.log(`[RAG Stream] RequestID: ${requestId} - ✅ Cached new embedding`);
              }
            } catch (generateError) {
              console.error(`[RAG Stream] RequestID: ${requestId} - Failed to generate embedding server-side:`, generateError);
              sendEvent('error', { error: 'Failed to generate query embedding. Please try again.' });
              controller.close();
              return;
            }
          } else {
            console.log(`[RAG Stream] RequestID: ${requestId} - Using client-provided embedding (${queryEmbedding.length}-dim)`);
          }

          const { data: results, error: searchError } = await supabase
            .rpc('smart_hybrid_search', {
              query_text: query,
              query_embedding: queryEmbedding,
              match_count: 10,
              p_user_id: user?.id || null, // Pass null for guests to search public documents only
              active_folder_ids: active_folders
            });

          if (searchError) {
            console.error('[RAG Stream] Search error:', searchError);
          }
          searchResults = results;
        }

        let retrievedChunks: SearchResult[] = [];

        if (searchResults && searchResults.length > 0) {
          console.log(`[RAG Stream] RequestID: ${requestId} - Raw search results: ${searchResults.length}`);
          retrievedChunks = searchResults.map((result: any) => {
            const hybridScore = result.hybrid_score ?? result.vector_score ?? result.similarity ?? 0;
            const similarity = Math.min(1, Math.max(0, hybridScore));

            return {
              chunk_id: result.chunk_id ?? result.id,
              document_id: result.document_id,
              chunk_text: result.chunk_text,
              similarity,
              title: result.title,
              source_url: result.source_url,
              document_type: result.document_type,
              chunk_index: result.chunk_index,
              trust_level: result.trust_level,
              vector_score: result.vector_score,
              bm25_score: result.bm25_score,
              hybrid_score: result.hybrid_score,
              search_strategy: result.search_strategy
            };
          });

          console.log(`[RAG Stream] RequestID: ${requestId} - Coarse results (top 10):`);
          retrievedChunks.slice(0, 10).forEach((chunk, index) => {
            console.log(
              `[RAG Stream] RequestID: ${requestId} - #${index + 1} chunk=${chunk.chunk_id} doc=${chunk.document_id} ` +
              `sim=${chunk.similarity.toFixed(4)} vec=${chunk.vector_score ?? 'n/a'} bm25=${chunk.bm25_score ?? 'n/a'} ` +
              `hybrid=${chunk.hybrid_score ?? 'n/a'} title="${chunk.title}"`
            );
          });
        } else {
          sendEvent('status', { 
            step: 'no_results', 
            message: 'No relevant documents found' 
          });
        }

        // Step 2.2: Rerank with 1024-dim embeddings in PLUS mode
        if (model_mode === 'standard' && retrievedChunks.length > 0) {
          sendEvent('status', { step: 'reranking', message: 'Reranking results...' });
          try {
            const queryEmbeddingLarge = await generateQueryEmbedding(query, 'query', 'bge-m3');
            console.log(`[RAG Stream] RequestID: ${requestId} - Rerank query embedding generated (${queryEmbeddingLarge.length}-dim)`);
            const chunkIds = retrievedChunks.map(chunk => chunk.chunk_id);

            const { data: chunkEmbeddings, error: chunkEmbeddingsError } = await supabase
              .from('document_chunks')
              .select('id, embedding_large')
              .in('id', chunkIds);

            if (chunkEmbeddingsError) {
              throw chunkEmbeddingsError;
            }

            const embeddingMap = new Map<string, number[]>();
            (chunkEmbeddings || []).forEach((row: any) => {
              if (Array.isArray(row.embedding_large)) {
                embeddingMap.set(row.id, row.embedding_large as number[]);
              }
            });

            const coverageRatio = embeddingMap.size / retrievedChunks.length;
            const rerankCoverageThreshold = 0.7;
            console.log(
              `[RAG Stream] RequestID: ${requestId} - Rerank coverage ${embeddingMap.size}/${retrievedChunks.length} ` +
              `(${(coverageRatio * 100).toFixed(0)}%), threshold=${Math.round(rerankCoverageThreshold * 100)}%`
            );
            if (coverageRatio < rerankCoverageThreshold) {
              console.warn(
                `[RAG Stream] RequestID: ${requestId} - Rerank skipped (coverage ${(coverageRatio * 100).toFixed(0)}% < ${Math.round(rerankCoverageThreshold * 100)}%)`
              );
            } else {
              const rerankScores = new Map<string, number>();
              retrievedChunks.forEach(chunk => {
                const embeddingLarge = embeddingMap.get(chunk.chunk_id);
                if (!embeddingLarge) return;
                const score = cosineSimilarity(queryEmbeddingLarge, embeddingLarge);
                rerankScores.set(chunk.chunk_id, score);
              });

              if (rerankScores.size > 0) {
                retrievedChunks = retrievedChunks.map(chunk => {
                  const score = rerankScores.get(chunk.chunk_id);
                  if (score === undefined) return chunk;
                  return {
                    ...chunk,
                    similarity: clampScore(score),
                    rerank_score: score,
                  };
                });

                retrievedChunks.sort((a, b) => {
                  const aScore = a.rerank_score;
                  const bScore = b.rerank_score;
                  if (aScore === undefined && bScore === undefined) return 0;
                  if (aScore === undefined) return 1;
                  if (bScore === undefined) return -1;
                  return bScore - aScore;
                });

                console.log(`[RAG Stream] RequestID: ${requestId} - Reranked results (top 10):`);
                retrievedChunks.slice(0, 10).forEach((chunk, index) => {
                  const rerankScore = chunk.rerank_score ?? null;
                  console.log(
                    `[RAG Stream] RequestID: ${requestId} - #${index + 1} chunk=${chunk.chunk_id} doc=${chunk.document_id} ` +
                    `rerank=${rerankScore !== null ? rerankScore.toFixed(4) : 'n/a'} ` +
                    `title="${chunk.title}"`
                  );
                });
              } else {
                console.warn(`[RAG Stream] RequestID: ${requestId} - No rerank scores computed; using coarse order`);
              }
            }
          } catch (rerankError) {
            console.warn(`[RAG Stream] RequestID: ${requestId} - Rerank failed, using coarse results:`, rerankError);
          }
        }

        if (retrievedChunks.length > 0) {
          sendEvent('sources', { 
            chunks: retrievedChunks,
            count: retrievedChunks.length 
          });
        }

        // Step 2.1: Store query history (authenticated users only)
        if (!isGuest && user && queryEmbedding) {
          try {
            await supabase
              .from('query_history')
              .insert({
                user_id: user.id,
                conversation_id,
                query_text: original_query || query,
                query_language: query_language || null,
                embedding: queryEmbedding,
                retrieved_chunks: retrievedChunks.length > 0
                  ? retrievedChunks.map(chunk => chunk.chunk_id)
                  : []
              });
          } catch (historyError) {
            console.error('[RAG Stream] Failed to insert query history:', historyError);
          }
        }

        // Step 3: Build context with structured memory
        sendEvent('status', { step: 'building_context', message: 'Building context...' });
        
        let structuredMemory;
        if (!isGuest && user) {
          // Build structured memory
          try {
            structuredMemory = await buildStructuredMemory(user.id, conversation_id, 4000);
          } catch (memoryError) {
            console.error('[RAG Stream] Memory error:', memoryError);
            structuredMemory = null;
          }
        } else {
          structuredMemory = null;
        }
        
        let context = '';
        if (retrievedChunks.length > 0) {
          context = retrievedChunks
            .map((chunk, idx) => {
              return `[Document ${idx + 1}: ${chunk.title}]\n${chunk.chunk_text}\n`;
            })
            .join('\n---\n\n');
        }

        // Step 4: Stream LLM response with Vercel AI SDK
        sendEvent('status', { step: 'generating', message: 'Generating answer...' });

        // Create model with response healing (automatic retry + JSON repair)
        const model = model_mode === 'mini'
          ? createModelWithHealing(ModelPresets.TRINITY_MINI)
          : createModelWithHealing(ModelPresets.TRINITY_LARGE);

        const memoryContext = structuredMemory 
          ? `\n\n${formatStructuredMemoryForPrompt(structuredMemory)}\n`
          : '';
        
        const systemPrompt = retrievedChunks.length > 0
          ? `You are a helpful government policy assistant. Answer questions based ONLY on the provided documents. 
If the answer is not in the documents, say "I don't have enough information to answer that question."
Always cite which document you're referencing (e.g., "According to Document 1...").
${memoryContext}
Context Documents:
${context}`
          : `You are a helpful government policy assistant. 
The user's question could not be matched with any documents in the knowledge base.
Politely inform them that you don't have information about their specific question.
${memoryContext}`;

        let fullResponse = '';
        let tokensUsed = 0;
        let llmSuccess = false; // Track if LLM generation succeeded

        try {
          // Stream the LLM response using Vercel AI SDK
          const result = await streamText({
            model,
            system: systemPrompt,
            prompt: query,
            temperature: 0.7,
            maxOutputTokens: 2048,
          });
          
          // Stream chunks to client
          for await (const chunk of result.textStream) {
            fullResponse += chunk;
            sendEvent('chunk', { content: chunk });
          }

          // Extract token usage (if available)
          tokensUsed = Math.ceil(fullResponse.length / 4); // Rough estimate
          
          sendEvent('status', { step: 'complete', message: 'Response generated' });
          llmSuccess = true; // Mark as successful
          
        } catch (llmError: any) {
          console.error('[RAG Stream] LLM error:', llmError);
          fullResponse = "I apologize, but I encountered an error while processing your question. Please try again.";
          sendEvent('chunk', { content: fullResponse });
        }

        // Step 5: Calculate confidence score
        const confidenceScore = calculateConfidenceScore(retrievedChunks, fullResponse, query);
        sendEvent('confidence', { score: confidenceScore });

        // Step 6: Save assistant message (only for authenticated users)
        let assistantMessage = null;
        
        if (!isGuestConversation) {
          const { data: savedAssistantMessage, error: assistantMsgError } = await supabase
            .from('chat_messages')
            .insert({
              conversation_id,
              role: 'assistant',
              content: fullResponse
            })
            .select()
            .single();

          if (assistantMsgError || !savedAssistantMessage) {
            console.error(`[RAG Stream] RequestID: ${requestId} - Error saving assistant message:`, assistantMsgError);
          } else {
            assistantMessage = savedAssistantMessage;
          }
        } else {
          // Guest user: create temporary message object (not saved to DB)
          console.log(`[RAG Stream] RequestID: ${requestId} - Guest conversation, not saving assistant message to DB`);
          assistantMessage = {
            id: `guest-msg-${Date.now() + 1}`,
            conversation_id,
            role: 'assistant',
            content: fullResponse,
            created_at: new Date().toISOString()
          };
        }
        
        if (assistantMessage) {
          sendEvent('assistant_message', { message: assistantMessage });
        }

        // Step 7: Update conversation title if first message (only for authenticated users)
        if (!isGuestConversation) {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversation_id);

          if (count === 2) {
            const title = query.length > 50 ? query.substring(0, 47) + '...' : query;
            await supabase
              .from('chat_conversations')
              .update({ title })
              .eq('id', conversation_id);
          }
        }

        // Step 8: Track usage (ONLY for authenticated users and if LLM succeeded)
        if (!isGuest && llmSuccess) {
          console.log(`[RAG Stream] RequestID: ${requestId} - Checking usage BEFORE increment...`);
          
          // Check current usage before incrementing
          const { data: beforeUsage } = await supabase
            .from('user_plans')
            .select('messages_used, messages_limit')
            .eq('user_id', user!.id)
            .single();
          
          console.log(`[RAG Stream] RequestID: ${requestId} - Usage BEFORE: ${beforeUsage?.messages_used}/${beforeUsage?.messages_limit}`);
          
          try {
            const { data: usageResult } = await supabase.rpc('increment_message_usage', {
              p_user_id: user!.id,
              p_tokens_used: tokensUsed
            });
            console.log(`[RAG Stream] RequestID: ${requestId} - Usage AFTER increment: ${usageResult?.messages_used}/${usageResult?.messages_limit}`);
          } catch (usageError) {
            console.error(`[RAG Stream] RequestID: ${requestId} - Usage tracking error:`, usageError);
          }
        } else if (isGuest) {
          console.log(`[RAG Stream] RequestID: ${requestId} - Guest user, NOT incrementing usage`);
        } else {
          console.log(`[RAG Stream] RequestID: ${requestId} - LLM generation failed, NOT incrementing usage`);
        }

        console.log(`[RAG Stream] RequestID: ${requestId} - ========== REQUEST COMPLETE ==========`);
        sendEvent('done', { success: true });
        controller.close();
        
      } catch (error) {
        console.error('[RAG Stream] Fatal error:', error);
        const message = `event: error\ndata: ${JSON.stringify({ error: 'Internal server error' })}\n\n`;
        controller.enqueue(encoder.encode(message));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
