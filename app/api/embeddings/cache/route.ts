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
 * Warm up query templates cache
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

    console.log('[Cache API] Starting template warmup...');
    
    // Warm up query templates
    await warmupQueryTemplates();
    
    console.log('[Cache API] Template warmup completed');

    return NextResponse.json({
      success: true,
      message: 'Query templates warmed up successfully'
    });
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