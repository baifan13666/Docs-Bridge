import { useState } from 'react';
import * as chatApi from '@/lib/api/chat';
import { useClientEmbedding } from './useClientEmbedding';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  sources?: chatApi.RAGQueryResult[];
  confidence?: chatApi.ConfidenceScore;
  metadata?: {
    language?: string;
    dialect?: string;
    query_rewritten?: boolean;
    keywords_added?: number;
    performance?: {
      total_time: number;
      preprocessing_time: number;
      language_detection: number;
      query_rewrite: number;
      embedding_generation: number;
      structured_memory: number;
    };
  };
}

interface RAGQueryOptions {
  onStepUpdate?: (stepId: number, status: 'pending' | 'active' | 'completed' | 'skipped', result?: string) => void;
  modelMode?: 'standard' | 'mini';
}

export function useRAGQuery() {
  const [querying, setQuerying] = useState(false);
  const { generateEmbedding } = useClientEmbedding();

  async function executeRAGQuery(
    queryText: string,
    conversationId: string | undefined,
    options: RAGQueryOptions = {}
  ): Promise<{
    conversationId: string;
    userMessage: Message;
    assistantMessage: Message;
  }> {
    const { onStepUpdate, modelMode = 'mini' } = options;
    
    setQuerying(true);
    try {
      // Step 1-3: Parallel preprocessing (language + rewrite + embedding + memory)
      onStepUpdate?.(1, 'active', 'Language detection');
      onStepUpdate?.(2, 'active', 'Query rewriting');
      onStepUpdate?.(3, 'active', 'Embedding generation');
      
      let convId = conversationId;
      
      // Create conversation if needed
      if (!convId) {
        const newConv = await chatApi.createConversation(queryText);
        convId = newConv.id;
      }
      
      // Generate query embedding for backward compatibility (parallel pipeline will generate its own)
      console.log('[useRAGQuery] Generating fallback embedding...');
      const embeddingResult = await generateEmbedding(queryText);
      const queryEmbedding = embeddingResult.embedding;
      
      onStepUpdate?.(1, 'completed', 'Language detected');
      onStepUpdate?.(2, 'completed', 'Query optimized');
      onStepUpdate?.(3, 'completed', `${queryEmbedding.length}-dim`);
      
      // Step 4-5: Parallel search and LLM generation
      onStepUpdate?.(4, 'active', 'Semantic search');
      onStepUpdate?.(5, 'active', 'Context building');
      
      // Call parallel RAG query endpoint
      const ragResponse = await chatApi.ragQuery(
        convId,
        queryText,
        queryEmbedding, // Fallback embedding (parallel pipeline generates its own)
        null,
        modelMode
      );
      
      onStepUpdate?.(4, 'completed', `${ragResponse.retrieved_chunks.length} docs found`);
      onStepUpdate?.(5, 'completed', 'Context built');
      
      // Step 6-7: LLM Generation and saving (done on server)
      onStepUpdate?.(6, 'active', 'Generating response');
      onStepUpdate?.(6, 'completed', 'Response generated');
      onStepUpdate?.(7, 'completed', 'Messages saved');
      
      // Convert messages to display format with enhanced metadata
      const userMessage: Message = {
        id: ragResponse.user_message.id,
        role: ragResponse.user_message.role,
        content: ragResponse.user_message.content,
        created_at: ragResponse.user_message.created_at
      };
      
      const assistantMessage: Message = {
        id: ragResponse.assistant_message.id,
        role: ragResponse.assistant_message.role,
        content: ragResponse.assistant_message.content,
        created_at: ragResponse.assistant_message.created_at,
        sources: ragResponse.retrieved_chunks.length > 0 ? ragResponse.retrieved_chunks : undefined,
        confidence: ragResponse.confidence_score,
        metadata: {
          language: ragResponse.metadata.language_detected,
          dialect: ragResponse.metadata.dialect_detected,
          query_rewritten: ragResponse.metadata.query_rewritten,
          keywords_added: ragResponse.metadata.keywords_added,
          performance: ragResponse.metadata.performance
        }
      };
      
      console.log(`[RAG] Parallel query completed: ${ragResponse.metadata.chunks_found} chunks found`);
      console.log(`[RAG] Performance: ${ragResponse.metadata.performance?.total_time}ms total, ${ragResponse.metadata.performance?.preprocessing_time}ms preprocessing`);
      
      return {
        conversationId: convId,
        userMessage,
        assistantMessage
      };
    } catch (error) {
      console.error('[useRAGQuery] Error in parallel RAG pipeline:', error);
      throw error;
    } finally {
      setQuerying(false);
    }
  }

  return {
    querying,
    executeRAGQuery
  };
}