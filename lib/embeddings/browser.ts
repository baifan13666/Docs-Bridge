/**
 * Browser-side Embedding with Transformers.js
 * 
 * Uses multilingual-e5-small (384-dim) with WebGPU acceleration
 * Falls back to WASM if WebGPU is not available
 * 
 * Architecture:
 * - Query embedding: e5-small (384-dim) in browser
 * - Document embedding: e5-large (1024-dim) on server
 * - Hybrid retrieval: browser coarse search → server rerank
 */

// Import environment setup FIRST
import './env-setup';

// Lazy import to avoid SSR issues
let transformers: any = null;
let env: any = null;

async function getTransformers() {
  if (!transformers) {
    try {
      console.log('[getTransformers] Loading @xenova/transformers...');
      const module = await import('@xenova/transformers');
      transformers = module;
      env = module.env;
      
      // Configure environment BEFORE using the library
      // Skip local model check (important for browser environments)
      env.allowLocalModels = false;
      
      // Allow remote models from Hugging Face Hub
      env.allowRemoteModels = true;
      
      console.log('[getTransformers] ✅ Transformers.js loaded successfully');
      console.log('[getTransformers] Environment config:', {
        allowLocalModels: env.allowLocalModels,
        allowRemoteModels: env.allowRemoteModels
      });
    } catch (error) {
      console.error('[getTransformers] ❌ Failed to load transformers.js:', error);
      throw error;
    }
  }
  return transformers;
}

// Model configuration
const MODEL_NAME = 'Xenova/multilingual-e5-small';
const EMBEDDING_DIM = 384;

// Global model instance
let embeddingModel: any = null;
let isInitializing = false;
let initPromise: Promise<any> | null = null;

// WebGPU detection
let webgpuAvailable: boolean | null = null;

/**
 * Check if WebGPU is available in the browser
 */
export async function checkWebGPU(): Promise<boolean> {
  if (webgpuAvailable !== null) {
    return webgpuAvailable;
  }

  try {
    if ('gpu' in navigator) {
      const adapter = await (navigator as any).gpu.requestAdapter();
      webgpuAvailable = adapter !== null;
      console.log('[Embedding] WebGPU available:', webgpuAvailable);
      return webgpuAvailable;
    }
  } catch (error) {
    console.warn('[Embedding] WebGPU check failed:', error);
  }

  webgpuAvailable = false;
  return false;
}

/**
 * Initialize the embedding model
 * 
 * @returns Promise that resolves to the model instance
 */
export async function initEmbedder(): Promise<any> {
  console.log('[initEmbedder] Called, current state:', { 
    hasModel: !!embeddingModel, 
    isInitializing 
  });
  
  // Return existing model if already initialized
  if (embeddingModel) {
    console.log('[initEmbedder] Model already initialized, returning existing instance');
    return embeddingModel;
  }

  // Wait for ongoing initialization
  if (isInitializing && initPromise) {
    console.log('[initEmbedder] Initialization in progress, waiting...');
    return initPromise;
  }

  // Start initialization
  console.log('[initEmbedder] Starting new initialization...');
  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log('[initEmbedder] Step 1: Loading transformers library...');
      
      // Load transformers library
      const { pipeline, env } = await getTransformers();
      console.log('[initEmbedder] ✅ Transformers library loaded');
      
      // Configure environment
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      console.log('[initEmbedder] Environment configured:', { 
        allowLocalModels: env.allowLocalModels, 
        allowRemoteModels: env.allowRemoteModels 
      });
      
      // Check WebGPU availability (for logging purposes)
      console.log('[initEmbedder] Step 2: Checking WebGPU...');
      const hasWebGPU = await checkWebGPU();
      console.log('[initEmbedder] WebGPU available:', hasWebGPU);
      console.log('[initEmbedder] Device selection: automatic (WebGPU → WASM fallback)');

      // Load the model
      console.log('[initEmbedder] Step 3: Loading model:', MODEL_NAME);
      const startTime = performance.now();
      embeddingModel = await pipeline(
        'feature-extraction',
        MODEL_NAME,
        {
          // Quantization for faster loading (optional)
          quantized: true,
        }
      );
      
      const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`[initEmbedder] ✅ Model loaded in ${loadTime}s`);
      console.log(`[initEmbedder] Embedding dimension: ${EMBEDDING_DIM}`);
      console.log('[initEmbedder] Model instance:', embeddingModel);

      return embeddingModel;
    } catch (error) {
      console.error('[initEmbedder] ❌ Failed to initialize model:', error);
      console.error('[initEmbedder] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      embeddingModel = null;
      throw error;
    } finally {
      isInitializing = false;
      console.log('[initEmbedder] Initialization complete, final state:', { 
        hasModel: !!embeddingModel, 
        isInitializing 
      });
    }
  })();

  return initPromise;
}

/**
 * Generate query embedding for a text string
 * 
 * @param query - The query text to embed
 * @returns Promise that resolves to a 384-dimensional embedding vector
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  console.log('[generateQueryEmbedding] Called with query:', query.substring(0, 50) + '...');
  
  if (!query || query.trim().length === 0) {
    throw new Error('Query text cannot be empty');
  }

  try {
    // Ensure model is initialized
    console.log('[generateQueryEmbedding] Ensuring model is initialized...');
    const model = await initEmbedder();
    console.log('[generateQueryEmbedding] Model ready:', !!model);

    // Normalize query (e5 models expect "query: " prefix for queries)
    const normalizedQuery = `query: ${query.trim()}`;
    console.log('[generateQueryEmbedding] Normalized query:', normalizedQuery.substring(0, 50) + '...');

    console.log('[generateQueryEmbedding] Calling model...');
    const startTime = performance.now();

    // Generate embedding
    const output = await model(normalizedQuery, {
      pooling: 'mean',
      normalize: true,
    });

    const embedTime = ((performance.now() - startTime) / 1000).toFixed(3);
    console.log(`[generateQueryEmbedding] Model call completed in ${embedTime}s`);
    console.log('[generateQueryEmbedding] Output:', output);
    console.log('[generateQueryEmbedding] Output.data:', output?.data);
    console.log('[generateQueryEmbedding] Output.data type:', typeof output?.data);

    // Validate output
    if (!output) {
      throw new Error('Model returned null or undefined output');
    }
    
    if (!output.data) {
      throw new Error('Model output missing data property');
    }

    // Extract the embedding array
    console.log('[generateQueryEmbedding] Converting output.data to array...');
    const embedding = Array.from(output.data) as number[];
    console.log('[generateQueryEmbedding] ✅ Embedding generated, length:', embedding.length);

    // Validate dimension
    if (embedding.length !== EMBEDDING_DIM) {
      console.warn(`[generateQueryEmbedding] ⚠️ Unexpected dimension: ${embedding.length}, expected ${EMBEDDING_DIM}`);
    }

    return embedding;
  } catch (error) {
    console.error('[generateQueryEmbedding] ❌ Failed to generate embedding:', error);
    console.error('[generateQueryEmbedding] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Batch generate embeddings for multiple queries
 * 
 * @param queries - Array of query texts
 * @returns Promise that resolves to array of embedding vectors
 */
export async function generateBatchEmbeddings(queries: string[]): Promise<number[][]> {
  if (!queries || queries.length === 0) {
    return [];
  }

  try {
    const model = await initEmbedder();

    // Normalize all queries
    const normalizedQueries = queries.map(q => `query: ${q.trim()}`);

    console.log(`[Embedding] Generating ${queries.length} embeddings...`);
    const startTime = performance.now();

    // Generate embeddings in batch
    const output = await model(normalizedQueries, {
      pooling: 'mean',
      normalize: true,
    });

    const embedTime = ((performance.now() - startTime) / 1000).toFixed(3);
    console.log(`[Embedding] Batch generated in ${embedTime}s`);

    // Extract embeddings
    const embeddings: number[][] = [];
    for (let i = 0; i < queries.length; i++) {
      const start = i * EMBEDDING_DIM;
      const end = start + EMBEDDING_DIM;
      embeddings.push(Array.from(output.data.slice(start, end)));
    }

    return embeddings;
  } catch (error) {
    console.error('[Embedding] Failed to generate batch embeddings:', error);
    throw error;
  }
}

/**
 * Get model information
 */
export function getModelInfo() {
  return {
    modelName: MODEL_NAME,
    embeddingDim: EMBEDDING_DIM,
    isInitialized: embeddingModel !== null,
    isInitializing,
    webgpuAvailable,
  };
}

/**
 * Cleanup model resources (optional, for memory management)
 */
export function cleanupModel() {
  if (embeddingModel) {
    console.log('[Embedding] Cleaning up model resources');
    embeddingModel = null;
    isInitializing = false;
    initPromise = null;
  }
}
