/**
 * React Hook for Embedding via API
 * 
 * Provides easy access to server-side embedding generation
 * All embedding generation is done via API route for maximum compatibility
 */

import { useState, useCallback } from 'react';

export interface EmbeddingState {
  isLoading: boolean;
  error: string | null;
}

export interface UseEmbeddingReturn extends EmbeddingState {
  embed: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
}

/**
 * Hook for generating embeddings via API
 * 
 * @returns Embedding state and functions
 * 
 * @example
 * ```tsx
 * const { embed, isLoading, error } = useEmbedding();
 * 
 * // Generate embedding
 * const embedding = await embed("How to apply for healthcare?");
 * ```
 */
export function useEmbedding(): UseEmbeddingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate embedding for a single text via API
   */
  const embed = useCallback(async (text: string): Promise<number[]> => {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useEmbedding] Calling API for embedding...');
      const response = await fetch('/api/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[useEmbedding] ✅ Embedding generated, dimension:', data.embedding.length);
      return data.embedding;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate embedding';
      console.error('[useEmbedding] ❌ Embedding failed:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Generate embeddings for multiple texts via API
   */
  const embedBatch = useCallback(async (texts: string[]): Promise<number[][]> => {
    if (!texts || texts.length === 0) {
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`[useEmbedding] Calling API for ${texts.length} embeddings...`);
      const response = await fetch('/api/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts: texts.map(t => t.trim()) }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[useEmbedding] ✅ Batch embeddings generated:', data.embeddings.length);
      return data.embeddings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate batch embeddings';
      console.error('[useEmbedding] ❌ Batch embedding failed:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    embed,
    embedBatch,
  };
}
