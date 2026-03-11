/**
 * Query Embedding Generation for RAG Search
 * 
 * Uses bge-small-en-v1.5 (384-dim) to match the Crawler Service's embedding_small
 * This ensures query embeddings are compatible with document embeddings in the database
 * 
 * IMPORTANT: This module ONLY uses @huggingface/transformers locally.
 * No external API calls are made for embedding generation.
 */

const MODEL = 'Xenova/bge-small-en-v1.5'; // 384-dim (still using Xenova namespace for model)
const EMBEDDING_DIM = 384;

let pipeline_instance: any = null;
let isInitializing = false;
let transformersAvailable: boolean | null = null;

// Dynamically import and configure transformers
async function getTransformersModule() {
  const { pipeline, env } = await import('@huggingface/transformers');
  
  // CRITICAL: Force WASM backend FIRST to prevent native library search
  // This prevents the "libonnxruntime.so.1: cannot open shared object file" error
  // By prioritizing 'wasm' over 'cpu', we use onnxruntime-web instead of onnxruntime-node
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.proxy = false;
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.simd = true;
  }
  
  // Configure environment for WASM backend (no native dependencies needed)
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = false;
  env.cacheDir = '/tmp/.transformers-cache';
  
  return { pipeline, env };
}

// Check if transformers is available
async function checkTransformersAvailability() {
  // Return cached result if already checked
  if (transformersAvailable !== null) {
    return transformersAvailable ? await getTransformersModule() : null;
  }
  
  try {
    const transformers = await getTransformersModule();
    transformersAvailable = true;
    return transformers;
  } catch (error) {
    console.error('[Query Embeddings] Transformers not available:', error instanceof Error ? error.message : String(error));
    transformersAvailable = false;
    return null;
  }
}

/**
 * Generate 384-dim query embedding
 * Compatible with Crawler Service's embedding_small
 * 
 * This function ONLY uses local transformers - no external API calls
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    // Check if transformers is available
    const transformers = await checkTransformersAvailability();
    if (!transformers) {
      throw new Error('Transformers library not available. This is required for embedding generation. Please ensure @huggingface/transformers and its dependencies (onnxruntime-web, onnxruntime-common) are properly installed.');
    }
    
    // Initialize model if needed (with proper locking)
    if (!pipeline_instance) {
      // Wait if another initialization is in progress
      while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Double-check after waiting
      if (!pipeline_instance) {
        try {
          isInitializing = true;
          console.log('[Query Embeddings] Initializing bge-small-en-v1.5 (384-dim) with WASM backend...');
          
          // CRITICAL: Set backend priority to force WASM usage
          // This must be done BEFORE pipeline initialization
          if (transformers.env.backends?.onnx?.wasm) {
            transformers.env.backends.onnx.wasm.proxy = false;
          }
          
          pipeline_instance = await transformers.pipeline('feature-extraction', MODEL, {
            dtype: 'q8', // Quantized 8-bit (default for WASM)
          });
          
          console.log('[Query Embeddings] ✅ bge-small-en-v1.5 model ready (WASM)');
        } catch (error) {
          console.error('[Query Embeddings] Failed to initialize bge-small-en-v1.5:', error);
          pipeline_instance = null;
          throw error;
        } finally {
          isInitializing = false;
        }
      }
    }
    
    console.log(`[Query Embeddings] Generating embedding for: "${query.substring(0, 50)}..."`);
    
    const output = await pipeline_instance(query, {
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
    transformersAvailable,
  };
}
