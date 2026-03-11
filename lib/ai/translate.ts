/**
 * Text Translation with Vercel AI SDK
 */

import { generateText, Output } from 'ai';
import { createModelWithHealing, ModelPresets } from './openrouter';
import { TranslationResultSchema } from './schemas';

export interface TranslationAlternative {
  text: string;
  confidence: number;
}

export interface TranslationResult {
  translated: string;
  confidence: number;
  alternatives?: TranslationAlternative[];
  source_language: string;
  target_language: string;
  target_dialect?: string | null;
}

export async function translateText(
  text: string,
  targetLanguage: string,
  targetDialect?: string | null,
  preserveSimplification: boolean = false
): Promise<TranslationResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  console.log(`[Translation] Translating to ${targetLanguage}${targetDialect ? ` (${targetDialect})` : ''}...`);

  try {
    const model = createModelWithHealing(ModelPresets.TRINITY_MINI);
    
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: TranslationResultSchema,
      }),
      prompt: `Translate the following text to ${targetLanguage}${targetDialect ? ` (${targetDialect} dialect)` : ''}.

Text: "${text}"

${preserveSimplification ? 'Maintain simple language level.' : ''}

Return JSON with: translated (string), confidence (0-100), alternatives (optional array)`,
      temperature: 0.5,
    });

    return {
      translated: output.translated,
      confidence: output.confidence,
      alternatives: output.alternatives,
      source_language: 'auto',
      target_language: targetLanguage,
      target_dialect: targetDialect,
    };
  } catch (error) {
    console.error('[Translation] ❌ Error:', error);
    throw error;
  }
}
