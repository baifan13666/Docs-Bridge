/**
 * Query Embedding Generation for RAG Search
 * 
 * Uses bge-small-en-v1.5 (384-dim) to match the Crawler Service's embedding_small
 * This ensures query embeddings are compatible with document embeddings in the database
 */

import { pipeline, env } from '@xenova/transformers';

// Configure WASM backend for Node.js
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.simd = true;
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = false;
env.cacheDir = '/tmp/.transformers-cache';

const MODEL = 'Xenova/bge-small-en-v1.5'; // 384-dim
const EMBEDDING_DIM = 384;

let pipeline_instance: any = null;
let isInitializing = false;

/**
 * Initialize bge-small-en-v1.5 model
 */
async function initModel() {
  if (pipeline_instance) return pipeline_instance;
  
  if (isInitializing) {
    // Wait for initialization to complete
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return pipeline_instance;
  }

  try {
    isInitializing = true;
    console.log('[Query Embeddings] Initializing bge-small-en-v1.5...');
    
    pipeline_instance = await pipeline('feature-extraction', MODEL, {
      quantized: true,
    });
    
    console.log('[Query Embeddings] ✅ Model ready');
    return pipeline_instance;
  } catch (error) {
    console.error('[Query Embeddings] Failed to initialize model:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Generate 384-dim query embedding
 * Compatible with Crawler Service's embedding_small
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    const model = await initModel();
    
    console.log(`[Query Embeddings] Generating embedding for: "${query.substring(0, 50)}..."`);
    
    const output = await model(query, {
      pooling: 'mean',
      normalize: true,
    });
    
    const embedding = Array.from(output.data) as number[];
    
    if (embedding.length !== EMBEDDING_DIM) {
      throw new Error(`Expected ${EMBEDDING_DIM}-dim embedding, got ${embedding.length}-dim`);
    }
    
    console.log(`[Query Embeddings] ✅ Generated ${embedding.length}-dim embedding`);
    return embedding;
  } catch (error) {
    console.error('[Query Embeddings] Error generating embedding:', error);
    throw new Error(`Failed to generate query embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate batch query embeddings
 */
export async function generateBatchQueryEmbeddings(queries: string[]): Promise<number[][]> {
  try {
    console.log(`[Query Embeddings] Generating batch embeddings for ${queries.length} queries...`);
    
    const embeddings = await Promise.all(
      queries.map(query => generateQueryEmbedding(query))
    );
    
    console.log(`[Query Embeddings] ✅ Batch completed: ${embeddings.length} embeddings`);
    return embeddings;
  } catch (error) {
    console.error('[Query Embeddings] Error generating batch embeddings:', error);
    throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get model information
 */
export function getModelInfo() {
  return {
    modelName: MODEL,
    embeddingDim: EMBEDDING_DIM,
    isInitialized: pipeline_instance !== null,
    isInitializing,
  };
}
