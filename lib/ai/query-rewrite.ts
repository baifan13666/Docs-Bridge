/**
 * Query Rewriting for Better Retrieval with Vercel AI SDK
 * 
 * Rewrites user queries to improve semantic search quality
 * More effective than dialect normalization for multilingual embeddings
 */

import { generateText, Output } from 'ai';
import { createModelWithHealing, ModelPresets } from './openrouter';
import { QueryRewriteSchema } from './schemas';
import { logAiError } from './error-logging';

export interface QueryRewriteResult {
  original: string;
  rewritten: string;
  added_keywords: string[];
  reasoning: string;
  confidence: number; // 0-1
}

/**
 * Rewrite query for better retrieval
 */
export async function rewriteQuery(
  query: string,
  detectedLanguage: string,
  dialect?: string | null,
  documentLanguage: string = 'en'
): Promise<QueryRewriteResult> {
  if (!query || query.trim().length === 0) {
    throw new Error('Query cannot be empty');
  }

  console.log(`[Query Rewrite] Rewriting query from ${detectedLanguage}${dialect ? ` (${dialect})` : ''} to ${documentLanguage}...`);

  try {
    const model = createModelWithHealing(ModelPresets.LFM_THINKING);
    
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: QueryRewriteSchema,
      }),
      prompt: buildQueryRewritePrompt(query, detectedLanguage, dialect, documentLanguage),
      temperature: 0.5,
    });

    const result: QueryRewriteResult = {
      original: query,
      rewritten: output.rewritten,
      added_keywords: output.added_keywords,
      reasoning: output.reasoning,
      confidence: output.confidence,
    };
    
    console.log(`[Query Rewrite] ✅ Rewritten with ${result.added_keywords.length} keywords added (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
    console.log(`[Query Rewrite] Original: "${query}"`);
    console.log(`[Query Rewrite] Rewritten: "${result.rewritten}"`);
    
    return result;
  } catch (error) {
    logAiError('Query Rewrite', error);
    
    // Fallback: Return original query
    return {
      original: query,
      rewritten: query,
      added_keywords: [],
      reasoning: 'Rewriting failed, using original query',
      confidence: 1.0,
    };
  }
}

/**
 * Build query rewriting prompt
 */
function buildQueryRewritePrompt(
  query: string,
  detectedLanguage: string,
  dialect: string | null | undefined,
  documentLanguage: string
): string {
  const languageNames: Record<string, string> = {
    en: 'English',
    ms: 'Malay',
    id: 'Indonesian',
    tl: 'Tagalog',
    ta: 'Tamil',
    zh: 'Chinese',
  };

  const sourceLang = languageNames[detectedLanguage] || detectedLanguage;
  const targetLang = languageNames[documentLanguage] || documentLanguage;
  const dialectInfo = dialect ? ` (${dialect} dialect)` : '';

  return `Rewrite the following user query to improve semantic search retrieval.

Original query: "${query}"
Query language: ${sourceLang}${dialectInfo}
Document language: ${targetLang}

Your task:
1. **Semantic Expansion**: Add related terms and concepts
2. **Intent Clarification**: Make the search intent explicit
3. **Keyword Enrichment**: Include relevant keywords that might appear in documents
4. **Translation** (if needed): Translate to ${targetLang} if different from query language
5. **Specificity**: Add context that helps match relevant documents

Guidelines:
- Focus on WHAT the user wants to know, not HOW they asked
- Include related terms (e.g., "flood assistance" → "flood relief", "disaster aid", "emergency assistance")
- Add context (e.g., "bantuan" → "government assistance programs")
- Make it search-friendly (clear, specific, keyword-rich)
- Keep the core intent intact
- If query is in dialect, normalize AND expand (don't just normalize)

Return a JSON object with: rewritten, added_keywords, reasoning, confidence (0-100)`;
}

/**
 * Check if query rewriting would be beneficial
 */
export function shouldRewriteQuery(
  query: string,
  detectedLanguage: string,
  dialect?: string | null
): boolean {
  // Skip only for very short queries (< 3 words)
  const wordCount = query.trim().split(/\s+/).length;
  return wordCount >= 3;
}
