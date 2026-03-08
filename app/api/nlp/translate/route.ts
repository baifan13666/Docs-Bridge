/**
 * Translation API
 * 
 * POST /api/nlp/translate
 * 
 * Translates text to target language/dialect while preserving simplification
 */

import { NextRequest, NextResponse } from 'next/server';
import { translateToDialect } from '@/lib/nlp/translate';

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      text, 
      target_language,
      target_dialect,
      preserve_simplification = true 
    } = body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    if (!target_language || typeof target_language !== 'string') {
      return NextResponse.json(
        { success: false, error: 'target_language is required' },
        { status: 400 }
      );
    }

    // Validate target language
    const validLanguages = ['en', 'ms', 'id', 'tl', 'ta', 'zh'];
    if (!validLanguages.includes(target_language)) {
      return NextResponse.json(
        { success: false, error: `Invalid target_language. Must be one of: ${validLanguages.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[Translate API] Translating to ${target_language}${target_dialect ? ` (${target_dialect})` : ''}...`);

    // Perform translation
    const result = await translateToDialect(
      text,
      target_language,
      target_dialect,
      preserve_simplification
    );

    console.log(`[Translate API] ✅ Translation complete (confidence: ${(result.confidence * 100).toFixed(1)}%)`);

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error('[Translate API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
