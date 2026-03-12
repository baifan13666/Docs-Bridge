/**
 * Text Simplification with Vercel AI SDK
 */

import { generateText, Output } from 'ai';
import { createModelWithHealing, ModelPresets } from './openrouter';
import { SimplificationResultSchema, type DifficultWord } from './schemas';

export interface ReadabilityScore {
  original: number;
  simplified: number;
  flesch_reading_ease: number;
  flesch_kincaid_grade: number;
  improvement: number;
}

export interface SimplificationResult {
  original: string;
  simplified: string;
  difficult_words: DifficultWord[];
  confidence: number;
  readability_score: ReadabilityScore;
}

function calculateReadabilityScores(original: string, simplified: string): ReadabilityScore {
  // Simplified calculation (real implementation would use proper formulas)
  const originalWords = original.split(/\s+/).length;
  const simplifiedWords = simplified.split(/\s+/).length;
  const improvement = Math.min(((originalWords - simplifiedWords) / originalWords) * 100, 50);
  
  // Calculate grade levels (simplified formula)
  const originalGrade = Math.max(5, 12 - (improvement / 10));
  const simplifiedGrade = Math.max(3, originalGrade - (improvement / 10));
  
  return {
    original: originalGrade,
    simplified: simplifiedGrade,
    flesch_reading_ease: 60 + improvement,
    flesch_kincaid_grade: simplifiedGrade,
    improvement: Math.round(improvement),
  };
}

export async function simplifyText(
  text: string,
  targetLevel: string = 'simple'
): Promise<SimplificationResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  console.log(`[Text Simplification] Simplifying to ${targetLevel} level...`);

  try {
    const model = createModelWithHealing(ModelPresets.TRINITY_MINI);
    
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: SimplificationResultSchema,
      }),
      prompt: `Simplify the following text to ${targetLevel} reading level.

Text: "${text}"

Guidelines:
- Use shorter sentences
- Replace complex words with simpler alternatives
- Maintain the original meaning
- Identify difficult words and provide simpler alternatives

Return JSON with: simplified (string), difficult_words (array of {word, explanation, simpler_alternative, context_snippet}), confidence (0-100)`,
      temperature: 0.5,
    });

    const readability_score = calculateReadabilityScores(text, output.simplified);

    return {
      original: text,
      simplified: output.simplified,
      difficult_words: output.difficult_words,
      confidence: output.confidence,
      readability_score,
    };
  } catch (error) {
    console.error('[Text Simplification] ❌ Error:', error);
    throw error;
  }
}
