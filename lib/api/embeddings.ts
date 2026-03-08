/**
 * Client-side API functions for embeddings
 */

export interface EmbeddingResponse {
  embedding: number[];
  dimension: number;
  modelName: string;
}

export interface BatchEmbeddingResponse {
  embeddings: number[][];
  dimension: number;
  modelName: string;
}

export interface ModelInfoResponse {
  modelName: string;
  embeddingDim: number;
  isInitialized: boolean;
  isInitializing: boolean;
}

/**
 * Generate embedding for a single text
 * 
 * @param text - Text to embed
 * @param type - Type of embedding: 'query' or 'document'
 * @returns Embedding vector
 */
export async function generateEmbedding(
  text: string,
  type: 'query' | 'document' = 'query'
): Promise<number[]> {
  const response = await fetch('/api/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, type }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate embedding');
  }

  const data: EmbeddingResponse = await response.json();
  return data.embedding;
}

/**
 * Generate embeddings for multiple texts
 * 
 * @param texts - Array of texts to embed
 * @param type - Type of embedding: 'query' or 'document'
 * @returns Array of embedding vectors
 */
export async function generateBatchEmbeddings(
  texts: string[],
  type: 'query' | 'document' = 'query'
): Promise<number[][]> {
  const response = await fetch('/api/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ texts, type }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate embeddings');
  }

  const data: BatchEmbeddingResponse = await response.json();
  return data.embeddings;
}

/**
 * Get model information
 * 
 * @returns Model information
 */
export async function getModelInfo(): Promise<ModelInfoResponse> {
  const response = await fetch('/api/embeddings', {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get model info');
  }

  return response.json();
}
