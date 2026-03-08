/**
 * Text Simplification API
 * 
 * POST /api/nlp/simplify
 * 
 * Simplifies government text to target reading level (Grade 5 by default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { simplifyText } from '@/lib/nlp/simplify';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, target_level = 'grade_5' } = body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    // Validate target level
    const validLevels = ['grade_5', 'grade_8', 'grade_10'];
    if (!validLevels.includes(target_level)) {
      return NextResponse.json(
        { success: false, error: 'Invalid target_level. Must be grade_5, grade_8, or grade_10' },
        { status: 400 }
      );
    }

    console.log(`[Simplify API] Simplifying text to ${target_level}...`);

    // Perform simplification
    const result = await simplifyText(text, target_level);

    console.log(`[Simplify API] ✅ Simplification complete`);

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error('[Simplify API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
