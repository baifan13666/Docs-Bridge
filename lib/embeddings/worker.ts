/**
 * Web Worker for Client-Side Embedding Generation
 * 
 * This worker runs in the browser and generates embeddings using Transformers.js
 * It prevents blocking the main thread during model loading and inference
 */

import { pipeline, env } from '@huggingface/transformers';

// Disable local models - always download from Hugging Face
env.allowLocalModels = false;

// Model configuration
const MODEL = 'Xenova/bge-small-en-v1.5'; // 384-dim embedding model
const TASK = 'feature-extraction';

/**
 * Singleton pattern for pipeline instance
 * Ensures the model is only loaded once
 */
class EmbeddingPipelineSingleton {
  static instance: any = null;
  static isLoading = false;

  static async getInstance(progress_callback?: (progress: any) => void): Promise<any> {
    if (this.instance === null && !this.isLoading) {
      this.isLoading = true;
      
      try {
        this.instance = await pipeline(TASK, MODEL, {
          progress_callback,
          dtype: 'q8', // Quantized 8-bit for faster loading
        });
        
        console.log('[Embedding Worker] Model loaded successfully');
      } catch (error) {
        console.error('[Embedding Worker] Failed to load model:', error);
        this.isLoading = false;
        throw error;
      }
      
      this.isLoading = false;
    }
    
    // Wait if loading is in progress
    while (this.isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return this.instance!;
  }
}

/**
 * Message handler for the worker
 */
self.addEventListener('message', async (event) => {
  const { type, text, id } = event.data;
  
  try {
    if (type === 'generate') {
      // Get or create pipeline instance
      const embedder = await EmbeddingPipelineSingleton.getInstance((progress) => {
        // Send progress updates to main thread
        self.postMessage({
          type: 'progress',
          id,
          progress: progress,
        });
      });
      
      // Send ready status
      self.postMessage({
        type: 'ready',
        id,
      });
      
      // Generate embedding
      const output = await embedder(text, {
        pooling: 'mean',
        normalize: true,
      });
      
      // Convert to array
      const embedding = Array.from(output.data) as number[];
      
      // Send result back to main thread
      self.postMessage({
        type: 'complete',
        id,
        embedding,
        dimension: embedding.length,
      });
      
    } else if (type === 'ping') {
      // Health check
      self.postMessage({
        type: 'pong',
        id,
      });
    }
    
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Export empty object for TypeScript
export {};
