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
import { getCachedEmbedding } from '@/lib/embeddings/cache';
import { generateBatchQueryEmbeddings, getModelInfo } from '@/lib/embeddings/query';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';

// Node.js runtime works fine with WASM backend (no Edge Runtime needed)
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
    // Verify authentication (allow guest users)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Allow guest users - only check for real auth errors
    if (authError && authError.message !== 'Auth session missing!') {
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      );
    }

    const isGuest = !user;
    console.log(`[Embeddings API] Request from ${isGuest ? 'GUEST' : 'authenticated'} user`);

    // Rate limiting for guest users
    if (isGuest) {
      const clientIP = getClientIP(request);
      const rateLimitResult = checkRateLimit(
        `guest-embedding:${clientIP}`,
        RATE_LIMITS.GUEST_EMBEDDING
      );

      if (!rateLimitResult.allowed) {
        const resetDate = new Date(rateLimitResult.resetTime);
        console.log(`[Embeddings API] Rate limit exceeded for IP ${clientIP}`);
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Please sign in to continue.',
            resetTime: resetDate.toISOString()
          },
          { status: 429 }
        );
      }

      console.log(`[Embeddings API] Guest rate limit: ${rateLimitResult.remaining} remaining`);
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
      // Single text embedding with cache
      const cachedResult = await getCachedEmbedding(text);

      return NextResponse.json({
        embedding: cachedResult.embedding,
        dimension: modelInfo.embeddingDim,
        modelName: modelInfo.modelName,
        cached: cachedResult.isFromCache,
        cacheSource: cachedResult.cacheSource,
        similarity: cachedResult.similarity
      });
    } else {
      // Batch embeddings (fallback to direct generation for now)
      // TODO: Implement batch caching
      const embeddings = await generateBatchQueryEmbeddings(texts);

      return NextResponse.json({
        embeddings,
        dimension: modelInfo.embeddingDim,
        modelName: modelInfo.modelName,
        cached: false
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
