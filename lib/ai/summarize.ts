/**
 * Text Summarization with Vercel AI SDK
 */

import { generateText, Output } from 'ai';
import { createModelWithHealing, ModelPresets } from './openrouter';
import { SummarizationResultSchema } from './schemas';
import { logAiError } from './error-logging';

export interface WordCount {
  original: number;
  summary: number;
  reduction: number; // percentage
}

export interface SummarizationResult {
  bullet_points: string[];
  key_actions: string[];
  tldr?: string; // Short paragraph summary (only for 'tldr' format)
  word_count: WordCount;
  confidence: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

export async function summarizeText(
  text: string,
  format: 'bullet_points' | 'key_actions' | 'tldr',
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
      tldr: text,
      word_count: {
        original: originalWordCount,
        summary: 0,
        reduction: 0,
      },
      confidence: 0.5,
    };
  }

  console.log(`[Summarization] Summarizing ${originalWordCount} words (format: ${format})...`);

  try {
    const model = createModelWithHealing(ModelPresets.TRINITY_MINI);
    
    // Different prompts based on format
    if (format === 'tldr') {
      // TLDR format: Generate a short paragraph summary
      const { output } = await generateText({
        model,
        output: Output.object({
          schema: SummarizationResultSchema,
        }),
        prompt: `Provide a concise TL;DR (Too Long; Didn't Read) summary of the following text in 2-3 sentences.

Text: "${text}"

Guidelines:
- Write a brief paragraph (2-3 sentences maximum)
- Capture the main point and key takeaway
- Use clear, simple language
- Make it standalone - someone should understand the essence without reading the full text

Return JSON with: 
- tldr (string): A 2-3 sentence paragraph summary
- bullet_points (array): Empty array (not used for tldr format)
- key_actions (array): Empty array (not used for tldr format)
- confidence (0-100): Your confidence in the summary quality`,
        temperature: 0.5,
      });

      const summaryWordCount = countWords(output.tldr || '');
      const reduction = ((originalWordCount - summaryWordCount) / originalWordCount) * 100;

      return {
        bullet_points: [],
        key_actions: [],
        tldr: output.tldr,
        word_count: {
          original: originalWordCount,
          summary: summaryWordCount,
          reduction: Math.round(reduction),
        },
        confidence: output.confidence,
      };
    } else {
      // Bullet points or key actions format
      const { output } = await generateText({
        model,
        output: Output.object({
          schema: SummarizationResultSchema,
        }),
        prompt: `Summarize the following text into ${maxPoints} bullet points and extract key actions.

Text: "${text}"

Guidelines:
- Create ${maxPoints} clear, concise bullet points covering the main ideas
- Extract actionable items as key actions
- Each bullet point should be a complete thought
- Prioritize the most important information

Return JSON with: 
- bullet_points (array of ${maxPoints} strings): Main points from the text
- key_actions (array of strings): Actionable items the reader should do
- confidence (0-100): Your confidence in the summary quality`,
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
    }
  } catch (error) {
    logAiError('Summarization', error);
    throw error;
  }
}
