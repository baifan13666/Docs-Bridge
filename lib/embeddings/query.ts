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
    console.warn('[Query Embeddings] Transformers not available, will use fallback API:', error instanceof Error ? error.message : String(error));
    transformersAvailable = false;
    return null;
  }
}

/**
 * Initialize bge-small-en-v1.5 model (384-dim)
 */
async function initModel() {
  if (pipeline_instance) return pipeline_instance;
  
  while (isInitializing) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (pipeline_instance) return pipeline_instance;

  try {
    isInitializing = true;
    console.log('[Query Embeddings] Initializing bge-small-en-v1.5 (384-dim) with WASM backend...');
    
    const transformers = await checkTransformersAvailability();
    if (!transformers) {
      throw new Error('Transformers not available');
    }
    
    pipeline_instance = await transformers.pipeline('feature-extraction', MODEL, {
      quantized: true,
    });
    
    console.log('[Query Embeddings] ✅ bge-small-en-v1.5 model ready (WASM)');
    return pipeline_instance;
  } catch (error) {
    console.error('[Query Embeddings] Failed to initialize bge-small-en-v1.5:', error);
    pipeline_instance = null;
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Fallback API call for embedding generation
 */
async function generateEmbeddingViaAPI(query: string): Promise<number[]> {
  try {
    console.log('[Query Embeddings] Using API fallback for embedding generation');
    
    const response = await fetch('/api/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: query }),
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding response from API');
    }
    
    return data.embedding;
  } catch (error) {
    console.error('[Query Embeddings] API fallback failed:', error);
    throw new Error(`Failed to generate embedding via API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate 384-dim query embedding
 * Compatible with Crawler Service's embedding_small
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    // First try to use local transformers
    if (transformersAvailable !== false) {
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
        
        console.log(`[Query Embeddings] ✅ Generated ${embedding.length}-dim embedding (local)`);
        return embedding;
      } catch (localError) {
        console.warn('[Query Embeddings] Local generation failed, trying API fallback:', localError instanceof Error ? localError.message : String(localError));
        transformersAvailable = false;
      }
    }
    
    // Fallback to API call
    return await generateEmbeddingViaAPI(query);
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
