import { useState } from 'react';
import * as chatApi from '@/lib/api/chat';
import { useEmbedding } from './useEmbedding';

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
  };
}

interface RAGQueryOptions {
  onStepUpdate?: (stepId: number, status: 'pending' | 'active' | 'completed' | 'skipped', result?: string) => void;
  modelMode?: 'standard' | 'mini';
}

export function useRAGQuery() {
  const [querying, setQuerying] = useState(false);
  const { embed } = useEmbedding();

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
      // Step 3: Embedding Generation
      onStepUpdate?.(3, 'active');
      
      let convId = conversationId;
      
      // Create conversation if needed
      if (!convId) {
        const newConv = await chatApi.createConversation(queryText);
        convId = newConv.id;
      }
      
      // Generate query embedding via API
      console.log('[useRAGQuery] Generating query embedding via API...');
      const queryEmbedding = await embed(queryText);
      console.log('[useRAGQuery] ✅ Query embedding generated, dimension:', queryEmbedding.length);
      onStepUpdate?.(3, 'completed', `${queryEmbedding.length}-dim`);
      
      // Step 4-5: Hybrid Search
      onStepUpdate?.(4, 'active');
      onStepUpdate?.(5, 'active');
      
      // Call RAG query endpoint with model mode
      const ragResponse = await chatApi.ragQuery(
        convId,
        queryText,
        queryEmbedding,
        null,
        modelMode
      );
      
      onStepUpdate?.(4, 'completed', '30 candidates');
      onStepUpdate?.(5, 'completed', `${ragResponse.retrieved_chunks.length} docs`);
      
      // Step 6: Context Building (done on server)
      onStepUpdate?.(6, 'completed');
      
      // Step 7: LLM Generation
      onStepUpdate?.(7, 'completed');
      
      // Convert messages to display format
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
        confidence: ragResponse.confidence_score
      };
      
      console.log(`[RAG] Query completed: ${ragResponse.metadata.chunks_found} chunks found`);
      
      return {
        conversationId: convId,
        userMessage,
        assistantMessage
      };
    } catch (error) {
      console.error('[useRAGQuery] Error in RAG pipeline:', error);
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
