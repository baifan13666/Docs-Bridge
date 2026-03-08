/**
 * Text Summarization API
 * 
 * POST /api/nlp/summarize
 * 
 * Summarizes text into bullet points and key actions
 * Uses hierarchical summarization for long texts
 */

import { NextRequest, NextResponse } from 'next/server';
import { summarizeText } from '@/lib/nlp/summarize';

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      text, 
      format = 'bullet_points',
      max_points = 5 
    } = body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    // Validate format
    const validFormats = ['bullet_points', 'key_actions', 'tldr'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Must be bullet_points, key_actions, or tldr' },
        { status: 400 }
      );
    }

    // Validate max_points
    if (typeof max_points !== 'number' || max_points < 1 || max_points > 10) {
      return NextResponse.json(
        { success: false, error: 'max_points must be between 1 and 10' },
        { status: 400 }
      );
    }

    console.log(`[Summarize API] Summarizing ${text.length} characters...`);

    // Perform summarization
    const result = await summarizeText(text, format, max_points);

    console.log(`[Summarize API] ✅ Summarization complete: ${result.word_count.reduction}% reduction`);

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error('[Summarize API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
