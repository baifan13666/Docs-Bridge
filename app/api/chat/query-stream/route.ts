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
import { createClient } from '@/lib/supabase/server';
import { Models } from '@/lib/langchain/openrouter';
import { withRetry } from '@/lib/langchain/structured';
import { calculateConfidenceScore } from '@/lib/nlp/confidence-score';
import { buildStructuredMemory, formatStructuredMemoryForPrompt } from '@/lib/nlp/structured-memory';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';

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
  const requestId = `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
          query_embedding,
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

        // Step 2: Semantic search with bge-small
        sendEvent('status', { step: 'searching', message: 'Searching knowledge base...' });
        
        // Only search if user is authenticated (guest users can't access user-specific documents)
        let searchResults = null;
        if (!isGuest && user) {
          const { data: results, error: searchError } = await supabase
            .rpc('search_chunks_small', {
              query_embedding,
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

        // Step 4: Stream LLM response with retry logic
        sendEvent('status', { step: 'generating', message: 'Generating answer...' });

        // Create model with retry logic for rate limiting
        const baseModel = model_mode === 'mini'
          ? Models.trinityMini({ temperature: 0.7, maxTokens: 2048 })
          : Models.trinityLarge({ temperature: 0.7, maxTokens: 2048 });
        
        const model = withRetry(baseModel);

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

        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: query }
        ];

        let fullResponse = '';
        let tokensUsed = 0;
        let retryCount = 0;
        const maxRetries = 3;
        let llmSuccess = false; // Track if LLM generation succeeded

        // Retry loop for streaming with exponential backoff
        while (retryCount < maxRetries) {
          try {
            // Stream the LLM response
            const stream = await model.stream(messages);
            
            for await (const chunk of stream) {
              const content = typeof chunk.content === 'string' 
                ? chunk.content 
                : JSON.stringify(chunk.content);
              
              fullResponse += content;
              
              // Send each chunk to the client
              sendEvent('chunk', { content });
            }

            // Extract token usage (if available)
            tokensUsed = Math.ceil(fullResponse.length / 4); // Rough estimate
            
            sendEvent('status', { step: 'complete', message: 'Response generated' });
            llmSuccess = true; // Mark as successful
            break; // Success, exit retry loop
            
          } catch (llmError: any) {
            retryCount++;
            console.error(`[RAG Stream] LLM error (attempt ${retryCount}/${maxRetries}):`, llmError);
            
            // Check if it's a rate limit error
            const isRateLimit = llmError?.message?.includes('429') || 
                               llmError?.status === 429 ||
                               llmError?.code === 'rate_limit_exceeded';
            
            if (isRateLimit && retryCount < maxRetries) {
              // Exponential backoff: 2^retryCount seconds
              const delayMs = Math.pow(2, retryCount) * 1000;
              console.log(`[RAG Stream] Rate limited, waiting ${delayMs}ms before retry...`);
              sendEvent('status', { 
                step: 'rate_limited', 
                message: `Rate limited, retrying in ${delayMs / 1000}s...` 
              });
              
              await new Promise(resolve => setTimeout(resolve, delayMs));
              continue; // Retry
            }
            
            // Non-rate-limit error or max retries reached
            if (retryCount >= maxRetries) {
              console.error('[RAG Stream] Max retries reached, giving up');
              fullResponse = "I apologize, but I'm experiencing high demand right now. Please try again in a moment.";
            } else {
              fullResponse = "I apologize, but I encountered an error while processing your question. Please try again.";
            }
            
            sendEvent('chunk', { content: fullResponse });
            break; // Exit retry loop
          }
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
