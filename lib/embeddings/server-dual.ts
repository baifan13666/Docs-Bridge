/**
 * Dual Embedding Generation (Server-Side)
 * 
 * Hybrid search strategy:
 * - e5-small (384-dim): Fast coarse search
 * - e5-large (1024-dim): Accurate reranking
 * 
 * Uses Transformers.js on Node.js for serverless compatibility
 */

// Model configurations
const SMALL_MODEL = 'Xenova/e5-small-v2'; // 384-dim
const LARGE_MODEL = 'Xenova/e5-large-v2'; // 1024-dim

// Singleton instances
let smallPipeline: any = null;
let largePipeline: any = null;
let isInitializingSmall = false;
let isInitializingLarge = false;
let transformers: any = null;

/**
 * Lazy load transformers library
 */
async function getTransformers() {
  if (transformers) return transformers;
  
  // Dynamic import to avoid build-time issues
  const module = await import('@xenova/transformers');
  transformers = module;
  
  // CRITICAL: Configure BEFORE any pipeline creation
  // Use WASM backend instead of native ONNX Runtime
  module.env.backends.onnx.wasm.numThreads = 1;
  module.env.backends.onnx.wasm.simd = true;
  module.env.allowLocalModels = false;
  module.env.allowRemoteModels = true;
  module.env.useBrowserCache = false;
  module.env.cacheDir = '/tmp/.transformers-cache';
  
  return module;
}

/**
 * Initialize e5-small model (384-dim)
 */
async function initSmallModel() {
  if (smallPipeline) return smallPipeline;
  if (isInitializingSmall) {
    // Wait for initialization
    while (isInitializingSmall) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return smallPipeline;
  }

  try {
    isInitializingSmall = true;
    console.log('[Embeddings] Initializing e5-small model (384-dim)...');
    
    const { pipeline } = await getTransformers();
    
    smallPipeline = await pipeline('feature-extraction', SMALL_MODEL, {
      quantized: true,
    });
    
    console.log('[Embeddings] ✅ e5-small model ready');
    return smallPipeline;
  } catch (error) {
    console.error('[Embeddings] Failed to initialize e5-small:', error);
    throw error;
  } finally {
    isInitializingSmall = false;
  }
}

/**
 * Initialize e5-large model (1024-dim)
 */
async function initLargeModel() {
  if (largePipeline) return largePipeline;
  if (isInitializingLarge) {
    // Wait for initialization
    while (isInitializingLarge) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return largePipeline;
  }

  try {
    isInitializingLarge = true;
    console.log('[Embeddings] Initializing e5-large model (1024-dim)...');
    
    const { pipeline } = await getTransformers();
    
    largePipeline = await pipeline('feature-extraction', LARGE_MODEL, {
      quantized: true,
    });
    
    console.log('[Embeddings] ✅ e5-large model ready');
    return largePipeline;
  } catch (error) {
    console.error('[Embeddings] Failed to initialize e5-large:', error);
    throw error;
  } finally {
    isInitializingLarge = false;
  }
}

/**
 * Generate 384-dim embedding with e5-small (for coarse search)
 */
export async function generateSmallEmbedding(text: string): Promise<number[]> {
  try {
    const model = await initSmallModel();
    
    // e5 models require "query: " prefix for queries
    const prefixedText = text.startsWith('query: ') ? text : `query: ${text}`;
    
    const output = await model(prefixedText, {
      pooling: 'mean',
      normalize: true,
    });
    
    return Array.from(output.data) as number[];
  } catch (error) {
    console.error('[Embeddings] Error generating small embedding:', error);
    throw new Error(`Failed to generate small embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate 1024-dim embedding with e5-large (for reranking)
 */
export async function generateLargeEmbedding(text: string): Promise<number[]> {
  try {
    const model = await initLargeModel();
    
    // e5 models require "query: " prefix for queries
    const prefixedText = text.startsWith('query: ') ? text : `query: ${text}`;
    
    const output = await model(prefixedText, {
      pooling: 'mean',
      normalize: true,
    });
    
    return Array.from(output.data) as number[];
  } catch (error) {
    console.error('[Embeddings] Error generating large embedding:', error);
    throw new Error(`Failed to generate large embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate dual embeddings (both 384-dim and 1024-dim)
 * Used for document processing
 */
export async function generateDualEmbeddings(text: string): Promise<{
  small: number[];
  large: number[];
}> {
  try {
    console.log('[Embeddings] Generating dual embeddings...');
    
    // For documents, use "passage: " prefix
    const prefixedText = text.startsWith('passage: ') ? text : `passage: ${text}`;
    
    // Generate both embeddings in parallel
    const [small, large] = await Promise.all([
      (async () => {
        const model = await initSmallModel();
        const output = await model(prefixedText, {
          pooling: 'mean',
          normalize: true,
        });
        return Array.from(output.data) as number[];
      })(),
      (async () => {
        const model = await initLargeModel();
        const output = await model(prefixedText, {
          pooling: 'mean',
          normalize: true,
        });
        return Array.from(output.data) as number[];
      })(),
    ]);
    
    console.log('[Embeddings] ✅ Dual embeddings generated');
    console.log(`[Embeddings] Small: ${small.length}-dim, Large: ${large.length}-dim`);
    
    return { small, large };
  } catch (error) {
    console.error('[Embeddings] Error generating dual embeddings:', error);
    throw new Error(`Failed to generate dual embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate batch dual embeddings for multiple texts
 */
export async function generateBatchDualEmbeddings(texts: string[]): Promise<Array<{
  small: number[];
  large: number[];
}>> {
  try {
    console.log(`[Embeddings] Generating batch dual embeddings for ${texts.length} texts...`);
    
    const results = await Promise.all(
      texts.map(text => generateDualEmbeddings(text))
    );
    
    console.log(`[Embeddings] ✅ Batch dual embeddings completed: ${results.length} items`);
    return results;
  } catch (error) {
    console.error('[Embeddings] Error generating batch dual embeddings:', error);
    throw new Error(`Failed to generate batch dual embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions don't match: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get model information
 */
export function getModelInfo() {
  return {
    smallModel: SMALL_MODEL,
    largeModel: LARGE_MODEL,
    smallDim: 384,
    largeDim: 1024,
    isSmallInitialized: smallPipeline !== null,
    isLargeInitialized: largePipeline !== null,
    isInitializingSmall,
    isInitializingLarge,
  };
}
