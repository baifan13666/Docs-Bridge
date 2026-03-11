/**
 * Text Summarization with Vercel AI SDK
 */

import { generateText, Output } from 'ai';
import { createModelWithHealing, ModelPresets } from './openrouter';
import { SummarizationResultSchema } from './schemas';

export interface WordCount {
  original: number;
  summary: number;
  reduction: number; // percentage
}

export interface SummarizationResult {
  bullet_points: string[];
  key_actions: string[];
  word_count: WordCount;
  confidence: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

export async function summarizeText(
  text: string,
  _format: string,
  maxPoints: number = 5
): Promise<SummarizationResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const originalWordCount = countWords(text);
  
  if (originalWordCount < 50) {
    return {
      bullet_points: [text],
      key_actions: ['Please read the full text'],
      word_count: {
        original: originalWordCount,
        summary: 0,
        reduction: 0,
      },
      confidence: 0.5,
    };
  }

  console.log(`[Summarization] Summarizing ${originalWordCount} words into ${maxPoints} points...`);

  try {
    const model = createModelWithHealing(ModelPresets.TRINITY_MINI);
    
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: SummarizationResultSchema,
      }),
      prompt: `Summarize the following text into ${maxPoints} bullet points and extract key actions.

Text: "${text}"

Return JSON with: bullet_points (array of ${maxPoints} strings), key_actions (array of strings), confidence (0-100)`,
      temperature: 0.5,
    });

    const summary = output.bullet_points.join(' ');
    const summaryWordCount = countWords(summary);
    const reduction = ((originalWordCount - summaryWordCount) / originalWordCount) * 100;

    return {
      bullet_points: output.bullet_points,
      key_actions: output.key_actions,
      word_count: {
        original: originalWordCount,
        summary: summaryWordCount,
        reduction: Math.round(reduction),
      },
      confidence: output.confidence,
    };
  } catch (error) {
    console.error('[Summarization] ❌ Error:', error);
    throw error;
  }
}
