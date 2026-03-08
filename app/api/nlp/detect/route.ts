/**
 * Language & Dialect Detection API
 * 
 * POST /api/nlp/detect
 * 
 * Detects the language and dialect of user input text
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectLanguage } from '@/lib/nlp/detect-language';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/nlp/detect
 * 
 * Request body:
 * {
 *   text: string;
 * }
 * 
 * Response:
 * {
 *   language: 'en' | 'ms' | 'id' | 'tl' | 'ta' | 'zh';
 *   dialect?: string | null;
 *   confidence: number;
 *   explanation: string;
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
    const { text } = body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    console.log(`[Detection API] User ${user.id} detecting language for: "${text.substring(0, 50)}..."`);

    // Detect language and dialect
    const detection = await detectLanguage(text);

    console.log(`[Detection API] ✅ Result: ${detection.language}${detection.dialect ? ` (${detection.dialect})` : ''}`);

    return NextResponse.json(detection);
  } catch (error) {
    console.error('[Detection API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to detect language',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
