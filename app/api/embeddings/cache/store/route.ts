/**
 * Store Client-Generated Embedding to Cache
 * 
 * POST /api/embeddings/cache/store
 * 
 * Allows clients to store their generated embeddings in the cache
 * for future reuse by other users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Store a client-generated embedding in the cache
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Allow both authenticated and guest users to contribute to cache
    const body = await request.json();
    const { query, embedding, language, dialect } = body;

    if (!query || !embedding || !Array.isArray(embedding)) {
      return NextResponse.json(
        { error: 'Invalid request: query and embedding array required' },
        { status: 400 }
      );
    }

    if (embedding.length !== 384) {
      return NextResponse.json(
        { error: 'Invalid embedding dimension: expected 384' },
        { status: 400 }
      );
    }

    // Generate hash for the query
    const normalized = query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\b(how|to|what|is|are|can|i|the|a|an)\b/g, '')
      .trim();

    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const queryHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Store in cache
    const { error } = await supabase
      .from('query_embeddings')
      .upsert({
        query_hash: queryHash,
        query_text: query,
        normalized_query: normalized,
        embedding: embedding,
        language: language,
        dialect: dialect,
        hit_count: 1,
        user_id: user?.id // Optional: track who contributed
      }, {
        onConflict: 'query_hash'
      });

    if (error) {
      console.error('[Cache Store API] Failed to store embedding:', error);
      return NextResponse.json(
        { error: 'Failed to store embedding in cache' },
        { status: 500 }
      );
    }

    console.log(`[Cache Store API] ✅ Stored embedding for: "${query.substring(0, 50)}..."`);

    return NextResponse.json({
      success: true,
      message: 'Embedding cached successfully',
      queryHash: queryHash.substring(0, 16) + '...'
    });
  } catch (error) {
    console.error('[Cache Store API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to store embedding',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
