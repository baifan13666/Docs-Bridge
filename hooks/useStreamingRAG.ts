/**
 * Streaming RAG Query Hook
 * 
 * Handles Server-Sent Events (SSE) for streaming LLM responses
 */

import { useState, useCallback } from 'react';

export interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sources?: any[];
  confidence?: any;
}

export interface StreamingStatus {
  step: string;
  message: string;
}

export interface UseStreamingRAGOptions {
  onChunk?: (chunk: string) => void;
  onStatus?: (status: StreamingStatus) => void;
  onSources?: (sources: any[]) => void;
  onConfidence?: (confidence: any) => void;
  onComplete?: (message: StreamingMessage) => void;
  onError?: (error: string) => void;
}

export function useStreamingRAG(options: UseStreamingRAGOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [currentStatus, setCurrentStatus] = useState<StreamingStatus | null>(null);

  const executeStreamingQuery = useCallback(async (
    conversationId: string,
    query: string,
    queryEmbedding: number[],
    modelMode: 'standard' | 'mini' = 'standard'
  ) => {
    setIsStreaming(true);
    setStreamedContent('');
    setCurrentStatus(null);

    try {
      const response = await fetch('/api/chat/query-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          query,
          query_embedding: queryEmbedding,
          model_mode: modelMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let userMessage: StreamingMessage | null = null;
      let assistantMessage: StreamingMessage | null = null;
      let sources: any[] = [];
      let confidence: any = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const [eventLine, dataLine] = line.split('\n');
          if (!eventLine.startsWith('event:') || !dataLine.startsWith('data:')) {
            continue;
          }

          const event = eventLine.substring(7).trim();
          const data = JSON.parse(dataLine.substring(6));

          switch (event) {
            case 'status':
              setCurrentStatus(data);
              options.onStatus?.(data);
              break;

            case 'user_message':
              userMessage = data.message;
              break;

            case 'sources':
              sources = data.chunks;
              options.onSources?.(sources);
              break;

            case 'chunk':
              setStreamedContent(prev => prev + data.content);
              options.onChunk?.(data.content);
              break;

            case 'confidence':
              confidence = data.score;
              options.onConfidence?.(confidence);
              break;

            case 'assistant_message':
              assistantMessage = data.message;
              break;

            case 'done':
              if (assistantMessage) {
                options.onComplete?.({
                  ...assistantMessage,
                  sources,
                  confidence,
                });
              }
              break;

            case 'error':
              options.onError?.(data.error);
              break;
          }
        }
      }

      return {
        userMessage,
        assistantMessage: assistantMessage ? {
          ...assistantMessage,
          sources,
          confidence,
        } : null,
      };

    } catch (error) {
      console.error('[useStreamingRAG] Error:', error);
      options.onError?.(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      setIsStreaming(false);
      setCurrentStatus(null);
    }
  }, [options]);

  return {
    isStreaming,
    streamedContent,
    currentStatus,
    executeStreamingQuery,
  };
}
