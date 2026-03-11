/**
 * Streaming RAG Query API with LangChain
 * 
 * POST /api/chat/query-stream
 * 
 * Complete RAG pipeline with streaming LLM response:
 * 1. Semantic search with bge-small (384-dim)
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
import { getCachedEmbedding } from '@/lib/embeddings/cache';
import { executeParallelPipeline, executeDualEmbeddingSearch } from '@/lib/rag/parallel-pipeline';

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
        } = body;

        console.log(`[RAG Stream] RequestID: ${requestId} - Received request for conversation: ${conversation_id}`);

        if (!conversation_id || !query) {
          sendEvent('error', { error: 'conversation_id and query are required' });
          controller.close();
          return;
        }

        console.log(`[RAG Stream] RequestID: ${requestId} - Starting streaming RAG pipeline...`);
        sendEvent('status', { step: 'started', message: 'Starting RAG pipeline...' });

        // Check if this is a guest conversation (temporary ID)
        const isGuestConversation = conversation_id.startsWith('guest-');
        
        let userMessage = null;
        
        if (!isGuestConversation) {
          // Step 1: Save user message (only for authenticated users)
          sendEvent('status', { step: 'saving_user_message', message: 'Saving your message...' });
          const { data: savedUserMessage, error: userMsgError } = await supabase
            .from('chat_messages')
            .insert({
              conversation_id,
              role: 'user',
              content: query
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
          // Guest user: create temporary message object (not saved to DB)
          console.log(`[RAG Stream] RequestID: ${requestId} - Guest conversation, not saving user message to DB`);
          userMessage = {
            id: `guest-msg-${Date.now()}`,
            conversation_id,
            role: 'user',
            content: query,
            created_at: new Date().toISOString()
          };
        }

        sendEvent('user_message', { message: userMessage });

        // Step 2: PARALLEL PIPELINE - Execute preprocessing in parallel (for authenticated users)
        let pipelineResult = null;
        if (!isGuest && user) {
          sendEvent('status', { step: 'preprocessing', message: 'Processing query in parallel...' });
          
          try {
            pipelineResult = await executeParallelPipeline(query, user.id, conversation_id);
            console.log(`[RAG Stream] RequestID: ${requestId} - ✅ Parallel preprocessing completed in ${pipelineResult.timings.total}ms`);
            console.log(`[RAG Stream] RequestID: ${requestId} - Language: ${pipelineResult.language}${pipelineResult.dialect ? ` (${pipelineResult.dialect})` : ''}`);
            console.log(`[RAG Stream] RequestID: ${requestId} - Query rewritten: ${pipelineResult.originalQuery !== pipelineResult.rewrittenQuery ? 'Yes' : 'No'}`);
            console.log(`[RAG Stream] RequestID: ${requestId} - Keywords added: ${pipelineResult.addedKeywords.length}`);
            console.log(`[RAG Stream] RequestID: ${requestId} - Cache hits: original=${pipelineResult.originalCacheHit}, rewritten=${pipelineResult.rewrittenCacheHit}`);
          } catch (pipelineError) {
            console.error(`[RAG Stream] RequestID: ${requestId} - Parallel pipeline failed:`, pipelineError);
            // Continue with fallback approach
          }
        }

        // Step 3: Semantic search
        sendEvent('status', { step: 'searching', message: 'Searching knowledge base...' });
        
        let searchResults = null;
        if (!isGuest && user) {
          if (pipelineResult) {
            // Use dual embedding search from parallel pipeline
            searchResults = await executeDualEmbeddingSearch(
              supabase,
              user.id,
              pipelineResult.originalEmbedding,
              pipelineResult.rewrittenEmbedding,
              active_folders,
              0.7, // match_threshold
              10   // match_count
            );
          } else {
            // Fallback: use provided embedding or check cache
            let queryEmbedding = providedEmbedding;
            if (!queryEmbedding) {
              try {
                const cachedResult = await getCachedEmbedding(query);
                if (cachedResult) {
                  queryEmbedding = cachedResult.embedding;
                  console.log(`[RAG Stream] RequestID: ${requestId} - Got embedding from cache (${cachedResult.isFromCache ? 'hit' : 'miss'})`);
                } else {
                  // No cache hit - client must provide embedding
                  console.error(`[RAG Stream] RequestID: ${requestId} - No cached embedding and none provided`);
                  sendEvent('error', { error: 'Query embedding required. Please generate embedding on client-side first.' });
                  controller.close();
                  return;
                }
              } catch (embeddingError) {
                console.error(`[RAG Stream] RequestID: ${requestId} - Failed to get embedding:`, embeddingError);
                sendEvent('error', { error: 'Failed to lookup query embedding' });
                controller.close();
                return;
              }
            }

            const { data: results, error: searchError } = await supabase
              .rpc('search_chunks_small', {
                query_embedding: queryEmbedding,
                match_threshold: 0.7,
                match_count: 10,
                user_id_param: user.id,
                active_folder_ids: active_folders
              });

            if (searchError) {
              console.error('[RAG Stream] Search error:', searchError);
            }
            searchResults = results;
          }
        }

        let retrievedChunks: SearchResult[] = [];

        if (searchResults && searchResults.length > 0) {
          retrievedChunks = searchResults.map((result: any) => ({
            chunk_id: result.id,
            document_id: result.document_id,
            chunk_text: result.chunk_text,
            similarity: result.similarity,
            title: result.title,
            source_url: result.source_url,
            document_type: result.document_type,
            chunk_index: result.chunk_index
          }));

          sendEvent('sources', { 
            chunks: retrievedChunks,
            count: retrievedChunks.length 
          });
        } else {
          sendEvent('status', { 
            step: 'no_results', 
            message: 'No relevant documents found' 
          });
        }

        // Step 3: Build context with structured memory
        sendEvent('status', { step: 'building_context', message: 'Building context...' });
        
        let structuredMemory;
        if (!isGuest && user) {
          if (pipelineResult && pipelineResult.structuredMemory) {
            // Use structured memory from parallel pipeline
            structuredMemory = pipelineResult.structuredMemory;
            console.log(`[RAG Stream] RequestID: ${requestId} - Using structured memory from parallel pipeline`);
          } else {
            // Fallback: build structured memory
            try {
              structuredMemory = await buildStructuredMemory(user.id, conversation_id, 4000);
            } catch (memoryError) {
              console.error('[RAG Stream] Memory error:', memoryError);
              structuredMemory = null;
            }
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
        
        // Build enhanced system prompt with parallel pipeline info
        let queryAnalysis = '';
        if (pipelineResult) {
          queryAnalysis = `
Query Analysis:
- Original: "${pipelineResult.originalQuery}"
- Language: ${pipelineResult.language}${pipelineResult.dialect ? ` (${pipelineResult.dialect})` : ''}
- Rewritten: "${pipelineResult.rewrittenQuery}"
- Keywords added: ${pipelineResult.addedKeywords.join(', ')}
- Cache performance: Original ${pipelineResult.originalCacheHit ? 'HIT' : 'MISS'}, Rewritten ${pipelineResult.rewrittenCacheHit ? 'HIT' : 'MISS'}
`;
        }
        
        const systemPrompt = retrievedChunks.length > 0
          ? `You are a helpful government policy assistant. Answer questions based ONLY on the provided documents. 
If the answer is not in the documents, say "I don't have enough information to answer that question."
Always cite which document you're referencing (e.g., "According to Document 1...").
${queryAnalysis}${memoryContext}
Context Documents:
${context}`
          : `You are a helpful government policy assistant. 
The user's question could not be matched with any documents in the knowledge base.
Politely inform them that you don't have information about their specific question.
${queryAnalysis}${memoryContext}`;

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
