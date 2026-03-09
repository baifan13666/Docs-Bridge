/**
 * Embedding API Route
 * 
 * POST /api/embeddings
 * 
 * Generate embeddings for text on the server side
 * Uses bge-small-en-v1.5 (384-dim) for query embeddings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateQueryEmbedding,
  generateBatchQueryEmbeddings,
  getModelInfo,
} from '@/lib/embeddings/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/embeddings
 * 
 * Request body:
 * {
 *   text: string;              // Single text to embed
 * }
 * 
 * OR
 * 
 * {
 *   texts: string[];           // Multiple texts to embed
 * }
 * 
 * Response:
 * {
 *   embedding: number[];       // Single embedding (if text provided)
 *   embeddings: number[][];    // Multiple embeddings (if texts provided)
 *   dimension: number;         // Embedding dimension (384)
 *   modelName: string;         // Model used (bge-small-en-v1.5)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { text, texts } = body;

    // Validate input
    if (!text && !texts) {
      return NextResponse.json(
        { error: 'Either "text" or "texts" must be provided' },
        { status: 400 }
      );
    }

    if (text && texts) {
      return NextResponse.json(
        { error: 'Provide either "text" or "texts", not both' },
        { status: 400 }
      );
    }

    // Get model info
    const modelInfo = getModelInfo();

    // Generate embeddings (always query type for RAG search)
    if (text) {
      // Single text embedding
      const embedding = await generateQueryEmbedding(text);

      return NextResponse.json({
        embedding,
        dimension: modelInfo.embeddingDim,
        modelName: modelInfo.modelName,
      });
    } else {
      // Batch embeddings
      const embeddings = await generateBatchQueryEmbeddings(texts);

      return NextResponse.json({
        embeddings,
        dimension: modelInfo.embeddingDim,
        modelName: modelInfo.modelName,
      });
    }
  } catch (error) {
    console.error('[Embeddings API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate embeddings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/embeddings
 * 
 * Get model information
 * 
 * Response:
 * {
 *   modelName: string;
 *   embeddingDim: number;
 *   isInitialized: boolean;
 *   isInitializing: boolean;
 * }
 */
export async function GET() {
  try {
    const modelInfo = getModelInfo();
    
    return NextResponse.json(modelInfo);
  } catch (error) {
    console.error('[Embeddings API] Error getting model info:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get model information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
