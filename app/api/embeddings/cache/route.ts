/**
 * Embedding Cache Management API
 * 
 * GET /api/embeddings/cache - Get cache statistics
 * POST /api/embeddings/cache/warmup - Warm up query templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCacheStats, warmupQueryTemplates } from '@/lib/embeddings/cache';

// Node.js runtime works fine with WASM backend (no Edge Runtime needed)
export const dynamic = 'force-dynamic';

/**
 * GET /api/embeddings/cache
 * 
 * Get cache performance statistics
 */
export async function GET() {
  try {
    // Verify authentication (admin only)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get cache statistics
    const stats = await getCacheStats();

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Cache API] Error getting stats:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get cache statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/embeddings/cache/warmup
 * 
 * DEPRECATED: Server-side cache warming is no longer supported.
 * Use client-side cache warming instead.
 * 
 * See CLIENT_EMBEDDING_GUIDE.md for client-side cache warming strategy.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication (admin only)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[Cache API] ⚠️ Server-side warmup is deprecated');

    return NextResponse.json({
      success: false,
      message: 'Server-side cache warming is deprecated. Use client-side warming instead.',
      recommendation: 'See CLIENT_EMBEDDING_GUIDE.md for client-side cache warming strategy'
    }, { status: 410 }); // 410 Gone - feature no longer available
  } catch (error) {
    console.error('[Cache API] Warmup error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to warm up cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}