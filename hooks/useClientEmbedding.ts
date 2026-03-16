/**
 * React Hook for Client-Side Embedding Generation
 * 
 * Uses Web Worker to generate embeddings in the browser without blocking the UI
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface EmbeddingResult {
  embedding: number[];
  dimension: number;
  cached: boolean;
}

export interface EmbeddingProgress {
  status: string;
  progress?: number;
  file?: string;
  loaded?: number;
  total?: number;
}

export interface UseClientEmbeddingReturn {
  generateEmbedding: (text: string) => Promise<EmbeddingResult>;
  generateEmbeddingWithCache: (text: string) => Promise<EmbeddingResult>;
  isReady: boolean;
  isLoading: boolean;
  progress: EmbeddingProgress | null;
  error: string | null;
}

export function useClientEmbedding(): UseClientEmbeddingReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<EmbeddingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Store pending requests
  const pendingRequests = useRef<Map<string, {
    resolve: (result: EmbeddingResult) => void;
    reject: (error: Error) => void;
  }>>(new Map());

  // Initialize worker
  useEffect(() => {
    if (typeof window === 'undefined') return; // Skip on server-side
    
    if (!workerRef.current) {
      try {
        // Create worker
        workerRef.current = new Worker(
          new URL('../lib/embeddings/worker.ts', import.meta.url),
          { type: 'module' }
        );
        
        // Handle messages from worker
        workerRef.current.addEventListener('message', (event) => {
          const { type, id, embedding, dimension, progress: progressData, error: errorMsg } = event.data;
          
          switch (type) {
            case 'progress':
              setProgress(progressData);
              setIsLoading(true);
              break;
              
            case 'ready':
              setIsReady(true);
              setIsLoading(false);
              setProgress(null);
              break;
              
            case 'complete':
              const request = pendingRequests.current.get(id);
              if (request) {
                request.resolve({
                  embedding,
                  dimension,
                  cached: false,
                });
                pendingRequests.current.delete(id);
              }
              setIsLoading(false);
              break;
              
            case 'error':
              const errorRequest = pendingRequests.current.get(id);
              if (errorRequest) {
                errorRequest.reject(new Error(errorMsg));
                pendingRequests.current.delete(id);
              }
              setError(errorMsg);
              setIsLoading(false);
              break;
              
            case 'pong':
              console.log('[Client Embedding] Worker is alive');
              break;
          }
        });
        
        // Handle worker errors
        workerRef.current.addEventListener('error', (event) => {
          console.error('[Client Embedding] Worker error:', event);
          setError(event.message);
          setIsLoading(false);
        });
        
        console.log('[Client Embedding] Worker initialized');
      } catch (err) {
        console.error('[Client Embedding] Failed to create worker:', err);
        setError(err instanceof Error ? err.message : 'Failed to create worker');
      }
    }
    
    // Cleanup
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Generate embedding
  const generateEmbedding = useCallback(async (text: string): Promise<EmbeddingResult> => {
    if (!workerRef.current) {
      throw new Error('Worker not initialized');
    }
    
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }
    
    // Generate unique ID for this request
    const id = `${Date.now()}-${Math.random()}`;
    
    // Create promise for this request
    const promise = new Promise<EmbeddingResult>((resolve, reject) => {
      pendingRequests.current.set(id, { resolve, reject });
      
      // Set timeout
      setTimeout(() => {
        if (pendingRequests.current.has(id)) {
          pendingRequests.current.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 60000); // 60 second timeout
    });
    
    // Send request to worker
    setIsLoading(true);
    setError(null);
    workerRef.current.postMessage({
      type: 'generate',
      text,
      id,
    });
    
    return promise;
  }, []);

  // Generate embedding with cache check
  const generateEmbeddingWithCache = useCallback(async (text: string): Promise<EmbeddingResult> => {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }
    
    try {
      // Step 1: Check cache first
      console.log('[Client Embedding] Checking cache for query...');
      const cacheResponse = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        if (cacheData.embedding) {
          console.log('[Client Embedding] ✅ Cache hit!');
          return {
            embedding: cacheData.embedding,
            dimension: cacheData.embedding.length,
            cached: true,
          };
        }
      }
      
      console.log('[Client Embedding] ❌ Cache miss, generating locally...');
      
      // Step 2: Generate locally using Web Worker
      try {
        const result = await generateEmbedding(text);
        
        // Step 3: Store in cache for future use
        console.log('[Client Embedding] Storing embedding in cache...');
        fetch('/api/embeddings/cache/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: text, 
            embedding: result.embedding 
          }),
        }).catch(err => {
          console.warn('[Client Embedding] Failed to cache embedding:', err);
        });
        
        return result;
      } catch (workerError) {
        console.error('[Client Embedding] Local generation failed:', workerError);
        throw workerError; // Let caller handle fallback to server
      }
      
    } catch (error) {
      console.error('[Client Embedding] Error in generateEmbeddingWithCache:', error);
      throw error;
    }
  }, [generateEmbedding]);

  return {
    generateEmbedding,
    generateEmbeddingWithCache,
    isReady,
    isLoading,
    progress,
    error,
  };
}
