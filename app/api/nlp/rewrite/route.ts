/**
 * Query Rewriting API
 * 
 * POST /api/nlp/rewrite
 * 
 * Rewrites user queries for better semantic search
 */

import { NextRequest, NextResponse } from 'next/server';
import { rewriteQuery } from '@/lib/nlp/query-rewrite';

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      query, 
      detected_language, 
      dialect = null,
      document_language = 'en'
    } = body;

    if (!query || !detected_language) {
      return NextResponse.json(
        { error: 'query and detected_language are required' },
        { status: 400 }
      );
    }

    console.log('[Rewrite API] Rewriting query:', query);

    const result = await rewriteQuery(
      query,
      detected_language,
      dialect,
      document_language
    );

    console.log('[Rewrite API] ✅ Query rewritten successfully');

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Rewrite API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to rewrite query' },
      { status: 500 }
    );
  }
}
