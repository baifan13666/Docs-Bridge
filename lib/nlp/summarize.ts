/**
 * Recursive Summarization
 * 
 * Condenses long government documents into bullet points and key actions
 * Uses hierarchical summarization for texts longer than 2000 characters
 */

import { createStructuredModel, withRetry } from '@/lib/langchain/structured';
import { SummarizationResultSchema, ModelPresets } from '@/lib/langchain';

export interface WordCount {
  original: number;
  summary: number;
  reduction: number; // percentage
}

export interface SummarizationResult {
  summary: string;
  bullet_points: string[];
  key_actions: string[];
  word_count: WordCount;
  confidence: number; // 0-1
}

/**
 * Summarize text into bullet points and key actions
 * 
 * @param text - Text to summarize
 * @param format - Output format
 * @param maxPoints - Maximum number of bullet points
 * @returns Summarization result
 * 
 * @example
 * ```typescript
 * const result = await summarizeText(
 *   "Long government policy document...",
 *   "bullet_points",
 *   5
 * );
 * // {
 * //   bullet_points: ["You must be a Malaysian citizen", ...],
 * //   key_actions: ["Download Form A", "Submit before March 31", ...],
 * //   ...
 * // }
 * ```
 */
export async function summarizeText(
  text: string,
  format: 'bullet_points' | 'key_actions' | 'tldr' = 'bullet_points',
  maxPoints: number = 5
): Promise<SummarizationResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  console.log(`[Summarization] Summarizing ${text.length} characters to ${maxPoints} ${format}...`);

  try {
    // Use hierarchical summarization for long texts
    if (text.length > 2000) {
      console.log('[Summarization] Using hierarchical summarization for long text');
      return await hierarchicalSummarize(text, format, maxPoints);
    }

    // Direct summarization for short texts
    return await directSummarize(text, format, maxPoints);

  } catch (error) {
    console.error('[Summarization] ❌ Error:', error);
    
    // Fallback: Return basic summary
    return {
      summary: text.substring(0, 200) + '...',
      bullet_points: ['Summary unavailable'],
      key_actions: ['Please read the full text'],
      word_count: {
        original: countWords(text),
        summary: 0,
        reduction: 0,
      },
      confidence: 0.5,
    };
  }
}

/**
 * Direct summarization for short texts (<2000 chars)
 */
async function directSummarize(
  text: string,
  _format: string, // Unused but kept for API compatibility
  maxPoints: number
): Promise<SummarizationResult> {
  // Use Trinity Mini for summarization with structured output
  const model = withRetry(
    createStructuredModel(SummarizationResultSchema, {
      name: 'summarize_text',
      model: ModelPresets.TRINITY_MINI,
      temperature: 0.5,
      maxTokens: 500,
    })
  );

  const prompt = buildSummarizationPrompt(text, maxPoints);
  
  const structuredResult = await model.invoke([
    { role: 'user', content: prompt }
  ]);

  // Create summary from bullet points and calculate word count
  const summary = structuredResult.bullet_points.join('\n');
  const originalWords = countWords(text);
  const summaryWords = countWords(summary);
  const reduction = originalWords > 0 
    ? Math.round((1 - summaryWords / originalWords) * 100)
    : 0;

  const result: SummarizationResult = {
    summary,
    bullet_points: structuredResult.bullet_points,
    key_actions: structuredResult.key_actions,
    confidence: structuredResult.confidence,
    word_count: {
      original: originalWords,
      summary: summaryWords,
      reduction,
    },
  };
  
  console.log(`[Summarization] ✅ Direct summarization complete: ${result.bullet_points.length} points, ${result.key_actions.length} actions`);
  
  return result;
}

/**
 * Hierarchical summarization for long texts (>2000 chars)
 * 
 * Process:
 * 1. Split text into chunks (~1000 chars each)
 * 2. Summarize each chunk
 * 3. Combine chunk summaries
 * 4. Summarize the combined summaries
 */
async function hierarchicalSummarize(
  text: string,
  format: string,
  maxPoints: number
): Promise<SummarizationResult> {
  // Step 1: Split into chunks
  const chunks = splitIntoChunks(text, 1000);
  console.log(`[Summarization] Split into ${chunks.length} chunks`);

  // Step 2: Summarize each chunk (3 points per chunk)
  const chunkSummaries = await Promise.all(
    chunks.map(chunk => directSummarize(chunk, format, 3))
  );

  // Step 3: Combine chunk summaries
  const combinedText = chunkSummaries
    .map(s => s.bullet_points.join('\n'))
    .join('\n\n');

  console.log(`[Summarization] Combined ${chunkSummaries.length} chunk summaries`);

  // Step 4: Final summarization
  const finalResult = await directSummarize(combinedText, format, maxPoints);

  // Update word count to reflect original text
  finalResult.word_count = {
    original: countWords(text),
    summary: countWords(finalResult.summary),
    reduction: Math.round((1 - countWords(finalResult.summary) / countWords(text)) * 100),
  };

  console.log(`[Summarization] ✅ Hierarchical summarization complete: ${finalResult.word_count.reduction}% reduction`);

  return finalResult;
}

/**
 * Build summarization prompt for LLM
 */
function buildSummarizationPrompt(text: string, maxPoints: number): string {
  return `Summarize the following text into ${maxPoints} bullet points and key actions.

Text:
"${text}"

Instructions:
1. Extract ${maxPoints} most important bullet points
2. Identify key actions the user needs to take
3. Focus on:
   - Eligibility criteria
   - Important deadlines or requirements
   - Required documents or steps
   - Contact information or next steps
4. Use simple, clear language
5. Be specific and actionable

Return ONLY a JSON object with this exact format:
{
  "bullet_points": [
    "You must be a Malaysian citizen",
    "Submit Form A before March 31",
    "Bring IC and proof of income"
  ],
  "key_actions": [
    "Download Form A from website",
    "Fill in personal details",
    "Submit to nearest office"
  ],
  "confidence": 95
}

Note: confidence should be 0-100 (e.g., 95 for 95%)

Examples:

Original: "The financial assistance program is available to Malaysian citizens aged 18 and above with monthly household income below RM3,000. Applicants must submit Form A together with copies of IC, latest payslip, and bank statement. The deadline for submission is March 31, 2026. Forms can be downloaded from www.example.gov.my or collected at any district office."

Bullet points:
- "You must be a Malaysian citizen aged 18+"
- "Your household income must be below RM3,000 per month"
- "Submit Form A with IC, payslip, and bank statement"
- "Deadline: March 31, 2026"
- "Get forms online or at district offices"

Key actions:
- "Download Form A from www.example.gov.my"
- "Prepare copies of IC, payslip, and bank statement"
- "Submit before March 31, 2026"

Return ONLY the JSON, no other text.`;
}



/**
 * Split text into chunks of approximately maxChars
 */
function splitIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}
