/**
 * Server-Side Embedding Generation (e5-small only)
 * 
 * Used by /api/embeddings endpoint for query embedding generation
 * Uses e5-small (384-dim) for fast query processing
 */

// Model configuration
const MODEL_NAME = 'Xenova/e5-small-v2'; // 384-dim
const EMBEDDING_DIM = 384;

// Singleton instance
let embeddingPipeline: any = null;
let isInitializing = false;
let transformers: any = null;

/**
 * Lazy load transformers library
 */
async function getTransformers() {
  if (transformers) return transformers;
  
  // Dynamic import to avoid build-time issues
  const module = await import('@xenova/transformers');
  transformers = module;
  
  // CRITICAL: Configure WASM backend BEFORE any pipeline creation
  // This prevents the libonnxruntime.so.1.14.0 error
  module.env.backends.onnx.wasm.numThreads = 1;
  module.env.backends.onnx.wasm.simd = true;
  module.env.allowLocalModels = false;
  module.env.allowRemoteModels = true;
  module.env.useBrowserCache = false;
  module.env.cacheDir = '/tmp/.transformers-cache';
  
  return module;
}

/**
 * Initialize e5-small model
 */
async function initModel() {
  if (embeddingPipeline) return embeddingPipeline;
  if (isInitializing) {
    // Wait for initialization
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return embeddingPipeline;
  }

  try {
    isInitializing = true;
    console.log('[Embeddings] Initializing e5-small model...');
    
    const { pipeline } = await getTransformers();
    
    embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: true,
    });
    
    console.log('[Embeddings] ✅ e5-small model ready');
    return embeddingPipeline;
  } catch (error) {
    console.error('[Embeddings] Failed to initialize model:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Generate query embedding (384-dim)
 * Uses "query: " prefix for e5 models
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  try {
    const model = await initModel();
    
    // e5 models require "query: " prefix for queries
    const prefixedText = text.startsWith('query: ') ? text : `query: ${text}`;
    
    console.log(`[Embeddings] Generating query embedding for: "${text.substring(0, 50)}..."`);
    
    const output = await model(prefixedText, {
      pooling: 'mean',
      normalize: true,
    });
    
    const embedding = Array.from(output.data) as number[];
    console.log(`[Embeddings] ✅ Query embedding generated: ${embedding.length}-dim`);
    
    return embedding;
  } catch (error) {
    console.error('[Embeddings] Error generating query embedding:', error);
    throw new Error(`Failed to generate query embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate document embedding (384-dim)
 * Uses "passage: " prefix for e5 models
 */
export async function generateDocumentEmbedding(text: string): Promise<number[]> {
  try {
    const model = await initModel();
    
    // e5 models require "passage: " prefix for documents
    const prefixedText = text.startsWith('passage: ') ? text : `passage: ${text}`;
    
    console.log(`[Embeddings] Generating document embedding for: "${text.substring(0, 50)}..."`);
    
    const output = await model(prefixedText, {
      pooling: 'mean',
      normalize: true,
    });
    
    const embedding = Array.from(output.data) as number[];
    console.log(`[Embeddings] ✅ Document embedding generated: ${embedding.length}-dim`);
    
    return embedding;
  } catch (error) {
    console.error('[Embeddings] Error generating document embedding:', error);
    throw new Error(`Failed to generate document embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate batch embeddings
 */
export async function generateBatchEmbeddings(
  texts: string[],
  type: 'query' | 'document' = 'query'
): Promise<number[][]> {
  try {
    console.log(`[Embeddings] Generating batch embeddings for ${texts.length} texts (type: ${type})...`);
    
    const embeddings = await Promise.all(
      texts.map(text => 
        type === 'query' 
          ? generateQueryEmbedding(text)
          : generateDocumentEmbedding(text)
      )
    );
    
    console.log(`[Embeddings] ✅ Batch embeddings completed: ${embeddings.length} items`);
    return embeddings;
  } catch (error) {
    console.error('[Embeddings] Error generating batch embeddings:', error);
    throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get model information
 */
export function getModelInfo() {
  return {
    modelName: MODEL_NAME,
    embeddingDim: EMBEDDING_DIM,
    isInitialized: embeddingPipeline !== null,
    isInitializing,
  };
}
