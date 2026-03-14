/**
 * Query Embedding Generation for RAG Search
 * 
 * Uses external Hugging Face Inference API for embedding generation
 * This avoids running heavy ML models on Vercel serverless functions
 * 
 * Supported models:
 * - intfloat/multilingual-e5-small (384-dim) - Default, multilingual
 * - altaidevorg/BGE-M3-Distill-8L (1024-dim) - Higher quality
 * 
 * E5 Model requires task-specific prefixes:
 * - "query: " prefix for search queries
 * - "passage: " prefix for documents/passages
 */

const E5_API_URL = process.env.E5_HG_EMBEDDING_SERVER_API_URL || 'https://edusocial-e5-small-embedding-server.hf.space';
const BGE_API_URL = process.env.BGE_HG_EMBEDDING_SERVER_API_URL || 'https://edusocial-bge-m3-embedding-server.hf.space';

const DEFAULT_MODEL = 'e5-small';
const EMBEDDING_DIM = 384;

export type EmbeddingModel = 'e5-small' | 'bge-m3';
export type EmbeddingTask = 'query' | 'passage';

interface SingleEmbeddingResponse {
  embedding: number[];
  dim: number;
}

interface BatchEmbeddingResponse {
  embeddings: number[][];
  count: number;
  dim: number;
}

/**
 * Generate 384-dim query embedding using external API
 * 
 * @param text - The text to embed
 * @param task - Task type: 'query' for search queries, 'passage' for documents (default: 'query')
 * @param model - Which model to use ('e5-small' or 'bge-m3')
 * @returns 384-dim or 1024-dim embedding vector
 */
export async function generateQueryEmbedding(
  text: string,
  task: EmbeddingTask = 'query',
  model: EmbeddingModel = 'e5-small'
): Promise<number[]> {
  try {
    const apiUrl = model === 'bge-m3' ? BGE_API_URL : E5_API_URL;
    
    console.log(`[Query Embeddings] Generating embedding via ${model} API...`);
    console.log(`[Query Embeddings] Task: ${task}, Text: "${text.substring(0, 50)}..."`);
    
    const response = await fetch(`${apiUrl}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,  // Single query uses "input" field
        task: task,   // 'query' or 'passage' - server will add prefix
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }
    
    const data: SingleEmbeddingResponse = await response.json();
    
    if (!data.embedding || data.embedding.length === 0) {
      throw new Error('No embedding returned from API');
    }
    
    console.log(`[Query Embeddings] ✅ Generated ${data.dim}-dim embedding via ${model} (task: ${task})`);
    
    return data.embedding;
  } catch (error) {
    console.error('[Query Embeddings] Error generating embedding:', error);
    throw new Error(`Failed to generate query embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate batch query embeddings
 * 
 * @param texts - Array of texts to embed
 * @param task - Task type: 'query' for search queries, 'passage' for documents (default: 'query')
 * @param model - Which model to use
 * @returns Array of embedding vectors
 */
export async function generateBatchQueryEmbeddings(
  texts: string[],
  task: EmbeddingTask = 'query',
  model: EmbeddingModel = 'e5-small'
): Promise<number[][]> {
  try {
    const apiUrl = model === 'bge-m3' ? BGE_API_URL : E5_API_URL;
    
    console.log(`[Query Embeddings] Generating batch embeddings for ${texts.length} texts via ${model}...`);
    console.log(`[Query Embeddings] Task: ${task}`);
    
    const response = await fetch(`${apiUrl}/embed/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: texts,  // Batch uses "inputs" field
        task: task,     // 'query' or 'passage' - server will add prefix
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }
    
    const data: BatchEmbeddingResponse = await response.json();
    
    if (!data.embeddings || data.embeddings.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings, got ${data.embeddings?.length || 0}`);
    }
    
    console.log(`[Query Embeddings] ✅ Batch completed: ${data.count} embeddings (${data.dim}-dim, task: ${task})`);
    
    return data.embeddings;
  } catch (error) {
    console.error('[Query Embeddings] Error generating batch embeddings:', error);
    throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get model information
 */
export function getModelInfo(model: EmbeddingModel = 'e5-small') {
  const apiUrl = model === 'bge-m3' ? BGE_API_URL : E5_API_URL;
  const dimension = model === 'bge-m3' ? 1024 : 384;
  const modelName = model === 'bge-m3' ? 'altaidevorg/BGE-M3-Distill-8L' : 'intfloat/multilingual-e5-small';
  
  return {
    modelName,
    embeddingDim: dimension,
    apiUrl,
    model,
  };
}


