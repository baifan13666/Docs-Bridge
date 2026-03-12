/**
 * Word Explanation API
 * 
 * POST /api/nlp/explain-word
 * 
 * Uses mini LLM to explain a difficult word in simple terms
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createModelWithHealing, ModelPresets } from '@/lib/ai';

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { word, context } = body;

    // Validate input
    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Word is required' },
        { status: 400 }
      );
    }

    console.log(`[Explain Word API] Explaining word: "${word}"`);

    // Use mini LLM for quick explanation
    const model = createModelWithHealing(ModelPresets.TRINITY_MINI);
    
    const prompt = context 
      ? `Explain the word "${word}" in simple terms. Here's the context where it was used: "${context}"\n\nProvide:\n1. A simple definition (1-2 sentences)\n2. A simpler alternative word or phrase\n3. An example sentence using the word\n\nKeep it brief and easy to understand.`
      : `Explain the word "${word}" in simple terms.\n\nProvide:\n1. A simple definition (1-2 sentences)\n2. A simpler alternative word or phrase\n3. An example sentence using the word\n\nKeep it brief and easy to understand.`;

    const { text: explanation } = await generateText({
      model,
      prompt,
      temperature: 0.3,
    });

    console.log(`[Explain Word API] ✅ Explanation generated`);

    return NextResponse.json({
      success: true,
      word,
      explanation: explanation.trim(),
    });

  } catch (error) {
    console.error('[Explain Word API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
