/**
 * Embedding API Route
 * 
 * POST /api/embeddings
 * 
 * Generate embeddings for text on the server side
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateQueryEmbedding,
  generateDocumentEmbedding,
  generateBatchEmbeddings,
  getModelInfo,
} from '@/lib/embeddings/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/embeddings
 * 
 * Request body:
 * {
 *   text: string;              // Single text to embed
 *   type?: 'query' | 'document'; // Type of embedding (default: 'query')
 * }
 * 
 * OR
 * 
 * {
 *   texts: string[];           // Multiple texts to embed
 *   type?: 'query' | 'document'; // Type of embedding (default: 'query')
 * }
 * 
 * Response:
 * {
 *   embedding: number[];       // Single embedding (if text provided)
 *   embeddings: number[][];    // Multiple embeddings (if texts provided)
 *   dimension: number;         // Embedding dimension
 *   modelName: string;         // Model used
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
    const { text, texts, type = 'query' } = body;

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

    if (type !== 'query' && type !== 'document') {
      return NextResponse.json(
        { error: 'Type must be either "query" or "document"' },
        { status: 400 }
      );
    }

    // Get model info
    const modelInfo = getModelInfo();

    // Generate embeddings
    if (text) {
      // Single text embedding
      const embedding = type === 'query'
        ? await generateQueryEmbedding(text)
        : await generateDocumentEmbedding(text);

      return NextResponse.json({
        embedding,
        dimension: modelInfo.embeddingDim,
        modelName: modelInfo.modelName,
      });
    } else {
      // Batch embeddings
      const embeddings = await generateBatchEmbeddings(texts, type);

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
