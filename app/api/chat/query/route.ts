/**
 * RAG Query API with LangChain
 * 
 * POST /api/chat/query
 * 
 * Complete RAG pipeline:
 * 1. Semantic search with bge-small (384-dim)
 * 2. Build context from retrieved chunks
 * 3. Call LLM with RAG context (using LangChain + OpenRouter)
 * 4. Save messages to database
 * 5. Return response with sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createModelWithHealing, ModelPresets } from '@/lib/ai';
import { calculateConfidenceScore } from '@/lib/nlp/confidence-score';
import { buildStructuredMemory, formatStructuredMemoryForPrompt } from '@/lib/nlp/structured-memory';
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
  const startTime = Date.now();
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const {
      conversation_id,
      query,
      query_embedding, // 384-dim from browser
      active_folders = null,
      model_mode = 'standard', // NEW: Accept model mode from client
    } = body;

    if (!conversation_id || !query) {
      return NextResponse.json(
        { success: false, error: 'conversation_id and query are required' },
        { status: 400 }
      );
    }

    console.log('[RAG Query] ========================================');
    console.log('[RAG Query] Starting PARALLEL RAG pipeline...');
    console.log(`[RAG Query] Query: ${query.substring(0, 100)}...`);
    console.log(`[RAG Query] Conversation: ${conversation_id}`);
    console.log(`[RAG Query] Model mode: ${model_mode} (${model_mode === 'mini' ? 'Trinity Mini' : 'Trinity Large'})`);

    // PARALLEL PIPELINE: Execute preprocessing in parallel
    console.log('[RAG Query] Step 1-3: Parallel preprocessing (language + rewrite + embedding + memory)...');
    const pipelineResult = await executeParallelPipeline(query, user.id, conversation_id);
    
    console.log(`[RAG Query] ✅ Parallel preprocessing completed in ${pipelineResult.timings.total}ms`);
    console.log(`[RAG Query] Language: ${pipelineResult.language}${pipelineResult.dialect ? ` (${pipelineResult.dialect})` : ''}`);
    console.log(`[RAG Query] Query rewritten: ${pipelineResult.originalQuery !== pipelineResult.rewrittenQuery ? 'Yes' : 'No'}`);
    console.log(`[RAG Query] Keywords added: ${pipelineResult.addedKeywords.length}`);

    // Step 4: Save user message (can be done in parallel with search)
    const [userMessageResult, searchResults] = await Promise.all([
      // Save user message
      supabase
        .from('chat_messages')
        .insert({
          conversation_id,
          role: 'user',
          content: query
        })
        .select()
        .single(),
      
      // Dual embedding search (uses both original and rewritten embeddings)
      executeDualEmbeddingSearch(
        supabase,
        user.id,
        pipelineResult.originalEmbedding,
        pipelineResult.rewrittenEmbedding,
        active_folders,
        0.7, // match_threshold
        10   // match_count
      )
    ]);

    const { data: userMessage, error: userMsgError } = userMessageResult;
    if (userMsgError || !userMessage) {
      console.error('[RAG Query] Error saving user message:', userMsgError);
      return NextResponse.json(
        { success: false, error: 'Failed to save user message' },
        { status: 500 }
      );
    }

    let retrievedChunks: SearchResult[] = [];

    if (searchResults && searchResults.length > 0) {
      console.log(`[RAG Query] ✅ Dual search found ${searchResults.length} unique chunks`);
      
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
      
      // Log top results
      retrievedChunks.slice(0, 3).forEach((chunk, idx) => {
        console.log(`[RAG Query]   ${idx + 1}. ${chunk.title} (similarity: ${(chunk.similarity * 100).toFixed(1)}%)`);
      });
    } else {
      console.log('[RAG Query] ⚠️ No relevant chunks found');
    }

    // Step 5: Build RAG context (structured memory already available from parallel pipeline)
    console.log('[RAG Query] Step 5: Building RAG context...');
    
    let context = '';
    if (retrievedChunks.length > 0) {
      context = retrievedChunks
        .map((chunk, idx) => {
          return `[Document ${idx + 1}: ${chunk.title}]\n${chunk.chunk_text}\n`;
        })
        .join('\n---\n\n');
      console.log(`[RAG Query] ✅ Context built: ${context.length} characters from ${retrievedChunks.length} documents`);
    } else {
      console.log('[RAG Query] ⚠️ No context available - will use fallback prompt');
    }

    // Step 6: Call LLM with RAG context (using Vercel AI SDK)
    console.log('[RAG Query] Step 6: Calling LLM with RAG context...');
    console.log(`[RAG Query] Model mode: ${model_mode}`);
    const llmStartTime = Date.now();

    // Create model with response healing (automatic retry + JSON repair)
    const model = model_mode === 'mini'
      ? createModelWithHealing(ModelPresets.TRINITY_MINI)
      : createModelWithHealing(ModelPresets.TRINITY_LARGE);

    // Build system prompt with structured memory (already available from parallel pipeline)
    const memoryContext = pipelineResult.structuredMemory 
      ? `\n\n${formatStructuredMemoryForPrompt(pipelineResult.structuredMemory)}\n`
      : '';
    
    const systemPrompt = retrievedChunks.length > 0
      ? `You are a helpful government policy assistant. Answer questions based ONLY on the provided documents. 
If the answer is not in the documents, say "I don't have enough information to answer that question."
Always cite which document you're referencing (e.g., "According to Document 1...").

Query Analysis:
- Original: "${pipelineResult.originalQuery}"
- Language: ${pipelineResult.language}${pipelineResult.dialect ? ` (${pipelineResult.dialect})` : ''}
- Rewritten: "${pipelineResult.rewrittenQuery}"
- Keywords added: ${pipelineResult.addedKeywords.join(', ')}
${memoryContext}
Context Documents:
${context}`
      : `You are a helpful government policy assistant. 
The user's question could not be matched with any documents in the knowledge base.
Politely inform them that you don't have information about their specific question, and suggest they:
1. Try rephrasing their question
2. Check if relevant documents have been added to the knowledge base
3. Contact support for more specific information

Query Analysis:
- Original: "${pipelineResult.originalQuery}"
- Language: ${pipelineResult.language}${pipelineResult.dialect ? ` (${pipelineResult.dialect})` : ''}
- Rewritten: "${pipelineResult.rewrittenQuery}"
${memoryContext}`;

    let assistantResponse: string;
    let tokensUsed = 0;
    try {
      console.log('[RAG Query] 🤖 Invoking LLM...');
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: query,
        temperature: 0.7,
        maxOutputTokens: 2048,
      });
      
      assistantResponse = result.text;
      
      // Extract token usage from response
      if (result.usage) {
        // AI SDK v6 uses 'promptTokens' and 'completionTokens'
        const promptTokens = (result.usage as any).promptTokens || 0;
        const completionTokens = (result.usage as any).completionTokens || 0;
        tokensUsed = promptTokens + completionTokens;
        console.log(`[RAG Query] 📊 Token usage: ${tokensUsed} (prompt: ${promptTokens}, completion: ${completionTokens})`);
      }
      
      const llmTime = Date.now() - llmStartTime;
      console.log(`[RAG Query] ✅ LLM response generated in ${llmTime}ms`);
      console.log(`[RAG Query] Response length: ${assistantResponse.length} characters`);
    } catch (llmError) {
      console.error('[RAG Query] ❌ LLM error:', llmError);
      assistantResponse = "I apologize, but I encountered an error while processing your question. Please try again.";
    }

    // Step 4.5: Calculate confidence score
    console.log('[RAG Query] Step 6.5: Calculating confidence score...');
    const confidenceScore = calculateConfidenceScore(retrievedChunks, assistantResponse, query);
    console.log(`[RAG Query] ✅ Confidence: ${(confidenceScore.overall * 100).toFixed(0)}% (${confidenceScore.level})`);
    console.log(`[RAG Query] Explanation: ${confidenceScore.explanation}`);

    // Step 5: Save assistant message
    console.log('[RAG Query] Step 7: Saving assistant message...');
    const { data: assistantMessage, error: assistantMsgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id,
        role: 'assistant',
        content: assistantResponse
      })
      .select()
      .single();

    if (assistantMsgError || !assistantMessage) {
      console.error('[RAG Query] Error saving assistant message:', assistantMsgError);
      return NextResponse.json(
        { success: false, error: 'Failed to save assistant message' },
        { status: 500 }
      );
    }

    // Step 6: Update conversation title if it's the first message
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversation_id);

    if (count === 2) { // First user + assistant message
      // Generate title from first message (truncate to 50 chars)
      const title = query.length > 50 ? query.substring(0, 47) + '...' : query;
      await supabase
        .from('chat_conversations')
        .update({ title })
        .eq('id', conversation_id);
    }

    // Step 7: Track usage (increment message count and token usage)
    console.log('[RAG Query] Step 8: Tracking usage...');
    try {
      const { data: usageResult, error: usageError } = await supabase
        .rpc('increment_message_usage', {
          p_user_id: user.id,
          p_tokens_used: tokensUsed
        });

      if (usageError) {
        console.error('[RAG Query] ⚠️ Failed to track usage:', usageError);
      } else {
        console.log(`[RAG Query] ✅ Usage tracked: ${usageResult.messages_used}/${usageResult.messages_limit} messages`);
      }
    } catch (usageError) {
      console.error('[RAG Query] ⚠️ Usage tracking error:', usageError);
      // Don't fail the request if usage tracking fails
    }

    console.log('[RAG Query] ✅ PARALLEL RAG pipeline completed successfully');
    console.log(`[RAG Query] 📊 Total pipeline time: ${Date.now() - startTime}ms`);
    console.log(`[RAG Query] 🚀 Preprocessing speedup: ${pipelineResult.timings.total}ms (parallel) vs estimated ${pipelineResult.timings.languageDetection + pipelineResult.timings.queryRewrite + pipelineResult.timings.originalEmbedding + pipelineResult.timings.structuredMemory}ms (sequential)`);
    console.log('[RAG Query] ========================================');

    return NextResponse.json({
      success: true,
      user_message: userMessage,
      assistant_message: assistantMessage,
      retrieved_chunks: retrievedChunks.map(chunk => ({
        chunk_id: chunk.chunk_id,
        document_id: chunk.document_id,
        title: chunk.title,
        similarity: chunk.similarity,
        source_url: chunk.source_url,
        chunk_text: chunk.chunk_text.substring(0, 200) + '...' // Truncate for response
      })),
      confidence_score: confidenceScore,
      metadata: {
        chunks_found: retrievedChunks.length,
        has_context: retrievedChunks.length > 0,
        // Parallel pipeline metadata
        language_detected: pipelineResult.language,
        dialect_detected: pipelineResult.dialect,
        query_rewritten: pipelineResult.originalQuery !== pipelineResult.rewrittenQuery,
        keywords_added: pipelineResult.addedKeywords.length,
        // Cache performance
        cache_performance: {
          original_cache_hit: pipelineResult.originalCacheHit,
          rewritten_cache_hit: pipelineResult.rewrittenCacheHit,
          cache_source: pipelineResult.cacheSource
        },
        performance: {
          total_time: Date.now() - startTime,
          preprocessing_time: pipelineResult.timings.total,
          language_detection: pipelineResult.timings.languageDetection,
          query_rewrite: pipelineResult.timings.queryRewrite,
          embedding_generation: pipelineResult.timings.originalEmbedding + pipelineResult.timings.rewrittenEmbedding,
          structured_memory: pipelineResult.timings.structuredMemory
        }
      }
    });

  } catch (error) {
    console.error('[RAG Query] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
