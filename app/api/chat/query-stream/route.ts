/**
 * Streaming RAG Query API with LangChain
 * 
 * POST /api/chat/query-stream
 * 
 * Complete RAG pipeline with streaming LLM response:
 * 1. Hybrid search (coarse + rerank)
 * 2. Build context from retrieved chunks
 * 3. Stream LLM response with RAG context
 * 4. Save messages to database
 * 5. Return SSE stream with sources
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Models } from '@/lib/langchain/openrouter';
import { withRetry } from '@/lib/langchain/structured';
import { generateLargeEmbedding, cosineSimilarity } from '@/lib/embeddings/server-dual';
import { calculateConfidenceScore } from '@/lib/nlp/confidence-score';
import { buildStructuredMemory, formatStructuredMemoryForPrompt } from '@/lib/nlp/structured-memory';

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
        if (authError || !user) {
          sendEvent('error', { error: 'Unauthorized' });
          controller.close();
          return;
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

        if (!conversation_id || !query) {
          sendEvent('error', { error: 'conversation_id and query are required' });
          controller.close();
          return;
        }

        console.log('[RAG Stream] Starting streaming RAG pipeline...');
        sendEvent('status', { step: 'started', message: 'Starting RAG pipeline...' });

        // Step 1: Save user message
        sendEvent('status', { step: 'saving_user_message', message: 'Saving your message...' });
        const { data: userMessage, error: userMsgError } = await supabase
          .from('chat_messages')
          .insert({
            conversation_id,
            role: 'user',
            content: query
          })
          .select()
          .single();

        if (userMsgError || !userMessage) {
          sendEvent('error', { error: 'Failed to save user message' });
          controller.close();
          return;
        }

        sendEvent('user_message', { message: userMessage });

        // Step 2: Hybrid search
        sendEvent('status', { step: 'searching', message: 'Searching knowledge base...' });
        
        const { data: coarseCandidates, error: searchError } = await supabase
          .rpc('search_similar_chunks_coarse', {
            query_embedding,
            match_threshold: 0.5,
            match_count: 30,
            p_user_id: user.id,
            active_folder_ids: active_folders
          });

        if (searchError) {
          console.error('[RAG Stream] Search error:', searchError);
        }

        let retrievedChunks: SearchResult[] = [];

        if (coarseCandidates && coarseCandidates.length > 0) {
          sendEvent('status', { 
            step: 'reranking', 
            message: `Found ${coarseCandidates.length} candidates, reranking...` 
          });
          
          const queryLargeEmbedding = await generateLargeEmbedding(query);

          retrievedChunks = coarseCandidates
            .map((candidate: any) => {
              const similarity = cosineSimilarity(queryLargeEmbedding, candidate.embedding_large);
              return {
                chunk_id: candidate.chunk_id,
                document_id: candidate.document_id,
                chunk_text: candidate.chunk_text,
                similarity,
                title: candidate.title,
                source_url: candidate.source_url,
                document_type: candidate.document_type,
                chunk_index: candidate.chunk_index
              };
            })
            .sort((a: any, b: any) => b.similarity - a.similarity)
            .slice(0, 5);

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
        try {
          structuredMemory = await buildStructuredMemory(user.id, conversation_id, 4000);
        } catch (memoryError) {
          console.error('[RAG Stream] Memory error:', memoryError);
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

        // Step 6: Save assistant message
        const { data: assistantMessage, error: assistantMsgError } = await supabase
          .from('chat_messages')
          .insert({
            conversation_id,
            role: 'assistant',
            content: fullResponse
          })
          .select()
          .single();

        if (assistantMsgError || !assistantMessage) {
          console.error('[RAG Stream] Error saving assistant message:', assistantMsgError);
        } else {
          sendEvent('assistant_message', { message: assistantMessage });
        }

        // Step 7: Update conversation title if first message
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

        // Step 8: Track usage
        try {
          await supabase.rpc('increment_message_usage', {
            p_user_id: user.id,
            p_tokens_used: tokensUsed
          });
        } catch (usageError) {
          console.error('[RAG Stream] Usage tracking error:', usageError);
        }

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
