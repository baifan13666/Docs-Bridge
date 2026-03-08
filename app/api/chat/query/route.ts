/**
 * RAG Query API with LangChain
 * 
 * POST /api/chat/query
 * 
 * Complete RAG pipeline:
 * 1. Hybrid search (coarse + rerank)
 * 2. Build context from retrieved chunks
 * 3. Call LLM with RAG context (using LangChain + OpenRouter)
 * 4. Save messages to database
 * 5. Return response with sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Models } from '@/lib/langchain/openrouter';
import { generateLargeEmbedding, cosineSimilarity } from '@/lib/embeddings/server-dual';
import { calculateConfidenceScore } from '@/lib/nlp/confidence-score';
import { buildStructuredMemory, formatStructuredMemoryForPrompt } from '@/lib/nlp/structured-memory';

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
    console.log('[RAG Query] Starting RAG pipeline...');
    console.log(`[RAG Query] Query: ${query.substring(0, 100)}...`);
    console.log(`[RAG Query] Conversation: ${conversation_id}`);
    console.log(`[RAG Query] Query embedding dimension: ${query_embedding.length}`);
    console.log(`[RAG Query] Model mode: ${model_mode} (${model_mode === 'mini' ? 'Trinity Mini' : 'Trinity Large'})`);

    // Step 1: Save user message
    console.log('[RAG Query] Step 1: Saving user message...');
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
      console.error('[RAG Query] Error saving user message:', userMsgError);
      return NextResponse.json(
        { success: false, error: 'Failed to save user message' },
        { status: 500 }
      );
    }

    // Step 2: Hybrid search (coarse + rerank)
    console.log('[RAG Query] Step 2: Performing hybrid search...');
    console.log('[RAG Query] - Phase 1: Coarse search with 384-dim embedding...');
    const searchStartTime = Date.now();

    // Coarse search with 384-dim embedding from client
    const { data: coarseCandidates, error: searchError } = await supabase
      .rpc('search_similar_chunks_coarse', {
        query_embedding,
        match_threshold: 0.5,
        match_count: 30, // ✅ UPDATED: 20 → 30 for better recall
        p_user_id: user.id,
        active_folder_ids: active_folders
      });

    if (searchError) {
      console.error('[RAG Query] ❌ Search error:', searchError);
    }

    let retrievedChunks: SearchResult[] = [];

    if (coarseCandidates && coarseCandidates.length > 0) {
      console.log(`[RAG Query] ✅ Coarse search found ${coarseCandidates.length} candidates`);
      console.log('[RAG Query] - Phase 2: Reranking with 1024-dim embedding...');
      
      // Server rerank with e5-large (1024-dim)
      const queryLargeEmbedding = await generateLargeEmbedding(query);
      console.log(`[RAG Query] ✅ Generated 1024-dim embedding for reranking`);

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

      const searchTime = Date.now() - searchStartTime;
      console.log(`[RAG Query] ✅ Reranking complete: Top ${retrievedChunks.length} chunks selected`);
      console.log(`[RAG Query] ✅ Total search time: ${searchTime}ms`);
      
      // Log top results
      retrievedChunks.forEach((chunk, idx) => {
        console.log(`[RAG Query]   ${idx + 1}. ${chunk.title} (similarity: ${(chunk.similarity * 100).toFixed(1)}%)`);
      });
    } else {
      console.log('[RAG Query] ⚠️ No relevant chunks found in coarse search');
    }

    // Step 3: Build RAG context with structured memory
    console.log('[RAG Query] Step 3: Building RAG context with structured memory...');
    
    // Build structured memory
    let structuredMemory;
    try {
      structuredMemory = await buildStructuredMemory(user.id, conversation_id, 4000);
      console.log(`[RAG Query] ✅ Structured memory built: ${structuredMemory.recent_messages.length} messages, ${structuredMemory.context_window.total_tokens} tokens`);
    } catch (memoryError) {
      console.error('[RAG Query] ⚠️ Error building structured memory:', memoryError);
      structuredMemory = null;
    }
    
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

    // Step 4: Call LLM with RAG context (using LangChain)
    console.log('[RAG Query] Step 4: Calling LLM with RAG context...');
    console.log(`[RAG Query] Model mode: ${model_mode}`);
    const llmStartTime = Date.now();

    // Create LangChain model based on user preference
    const model = model_mode === 'mini'
      ? Models.trinityMini({
          temperature: 0.7,
          maxTokens: 2048,
        })
      : Models.trinityLarge({
          temperature: 0.7,
          maxTokens: 2048,
        });

    // Build system prompt with structured memory
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
Politely inform them that you don't have information about their specific question, and suggest they:
1. Try rephrasing their question
2. Check if relevant documents have been added to the knowledge base
3. Contact support for more specific information
${memoryContext}`;

    // Call LLM
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: query }
    ];

    let assistantResponse: string;
    let tokensUsed = 0;
    try {
      console.log('[RAG Query] 🤖 Invoking LLM...');
      const response = await model.invoke(messages);
      assistantResponse = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);
      
      // Extract token usage from response metadata
      if (response.response_metadata?.tokenUsage) {
        const usage = response.response_metadata.tokenUsage as any;
        tokensUsed = (usage.promptTokens || 0) + (usage.completionTokens || 0);
        console.log(`[RAG Query] 📊 Token usage: ${tokensUsed} (prompt: ${usage.promptTokens}, completion: ${usage.completionTokens})`);
      }
      
      const llmTime = Date.now() - llmStartTime;
      console.log(`[RAG Query] ✅ LLM response generated in ${llmTime}ms`);
      console.log(`[RAG Query] Response length: ${assistantResponse.length} characters`);
    } catch (llmError) {
      console.error('[RAG Query] ❌ LLM error:', llmError);
      assistantResponse = "I apologize, but I encountered an error while processing your question. Please try again.";
    }

    // Step 4.5: Calculate confidence score
    console.log('[RAG Query] Step 4.5: Calculating confidence score...');
    const confidenceScore = calculateConfidenceScore(retrievedChunks, assistantResponse, query);
    console.log(`[RAG Query] ✅ Confidence: ${(confidenceScore.overall * 100).toFixed(0)}% (${confidenceScore.level})`);
    console.log(`[RAG Query] Explanation: ${confidenceScore.explanation}`);

    // Step 5: Save assistant message
    console.log('[RAG Query] Step 5: Saving assistant message...');
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
    console.log('[RAG Query] Step 7: Tracking usage...');
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

    console.log('[RAG Query] ✅ RAG pipeline completed successfully');
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
        has_context: retrievedChunks.length > 0
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
