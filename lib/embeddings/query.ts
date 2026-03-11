/**
 * Query Embedding Generation for RAG Search
 * 
 * Uses bge-small-en-v1.5 (384-dim) to match the Crawler Service's embedding_small
 * This ensures query embeddings are compatible with document embeddings in the database
 */

const MODEL = 'Xenova/bge-small-en-v1.5'; // 384-dim
const EMBEDDING_DIM = 384;

let pipeline_instance: any = null;
let isInitializing = false;
let transformersAvailable = false;

// Check if transformers is available without importing it
async function checkTransformersAvailability() {
  try {
    // Only import transformers if we're not in a build environment
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      // In production, try to dynamically import
      const { pipeline, env } = await import('@xenova/transformers');
      
      // Configure environment
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.simd = true;
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = false;
      env.cacheDir = '/tmp/.transformers-cache';
      
      transformersAvailable = true;
      return { pipeline, env };
    } else {
      // In development, import normally
      const { pipeline, env } = await import('@xenova/transformers');
      
      // Configure environment
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.simd = true;
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = false;
      env.cacheDir = '/tmp/.transformers-cache';
      
      transformersAvailable = true;
      return { pipeline, env };
    }
  } catch (error) {
    console.warn('[Query Embeddings] Transformers not available:', error instanceof Error ? error.message : String(error));
    transformersAvailable = false;
    return null;
  }
}

/**
 * Generate 384-dim query embedding
 * Compatible with Crawler Service's embedding_small
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    // Try to use local transformers
    const transformers = await checkTransformersAvailability();
    if (!transformers) {
      throw new Error('Transformers library not available - this may be due to missing native dependencies like sharp');
    }
    
    // Initialize model if needed
    if (!pipeline_instance) {
      while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!pipeline_instance) {
        try {
          isInitializing = true;
          console.log('[Query Embeddings] Initializing bge-small-en-v1.5 (384-dim) with WASM backend...');
          
          pipeline_instance = await transformers.pipeline('feature-extraction', MODEL, {
            quantized: true,
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
