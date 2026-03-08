/**
 * Text Simplification
 * 
 * Simplifies government language to Grade 5 readability level
 * Uses LangChain with OpenRouter for simplification
 */

import { createStructuredModel, withRetry } from '@/lib/langchain/structured';
import { SimplificationResultSchema, ModelPresets } from '@/lib/langchain';

export interface DifficultWord {
  word: string;
  explanation: string;
  simpler_alternative: string;
  context_snippet?: string; // Optional context snippet
}

export interface ReadabilityScore {
  original: number;
  simplified: number;
  metric: 'flesch_reading_ease' | 'fkgl';
  improvement: string; // e.g., "Grade 12 → Grade 5"
}

export interface SimplificationResult {
  original: string;
  simplified: string;
  difficult_words: DifficultWord[];
  readability_score: ReadabilityScore;
  confidence: number; // 0-1
}

/**
 * Simplify text to target reading level
 * 
 * @param text - Text to simplify
 * @param targetLevel - Target reading level
 * @returns Simplification result
 * 
 * @example
 * ```typescript
 * const result = await simplifyText(
 *   "Eligible beneficiaries must submit supporting documentation...",
 *   "grade_5"
 * );
 * // {
 * //   simplified: "You must send your documents...",
 * //   difficult_words: [{ word: "eligible", explanation: "...", ... }],
 * //   ...
 * // }
 * ```
 */
export async function simplifyText(
  text: string,
  targetLevel: 'grade_5' | 'grade_8' | 'grade_10' = 'grade_5'
): Promise<SimplificationResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  console.log(`[Text Simplification] Simplifying to ${targetLevel} level...`);

  try {
    // Use Trinity Mini model for simplification with structured output
    const model = withRetry(
      createStructuredModel(SimplificationResultSchema, {
        name: 'simplify_text',
        model: ModelPresets.TRINITY_MINI,
        temperature: 0.5, // Moderate creativity for natural simplification
        maxTokens: 1000,
      })
    );

    const prompt = buildSimplificationPrompt(text, targetLevel);
    
    const structuredResult = await model.invoke([
      { role: 'user', content: prompt }
    ]);

    // Calculate readability scores
    const readability_score = calculateReadabilityScores(text, structuredResult.simplified);

    // Build result with all required fields
    const result: SimplificationResult = {
      original: text,
      simplified: structuredResult.simplified,
      difficult_words: structuredResult.difficult_words,
      confidence: structuredResult.confidence,
      readability_score,
    };
    
    console.log(`[Text Simplification] ✅ Simplified with ${result.difficult_words.length} difficult words identified`);
    console.log(`[Text Simplification] Readability: ${result.readability_score.improvement}`);
    
    return result;
  } catch (error) {
    console.error('[Text Simplification] ❌ Error:', error);
    
    // Fallback: Return original text
    return {
      original: text,
      simplified: text,
      difficult_words: [],
      readability_score: {
        original: 50,
        simplified: 50,
        metric: 'flesch_reading_ease',
        improvement: 'No change',
      },
      confidence: 0.5,
    };
  }
}

/**
 * Build simplification prompt for LLM
 */
function buildSimplificationPrompt(text: string, targetLevel: string): string {
  const levelDescriptions: Record<string, string> = {
    grade_5: 'Grade 5 (10-11 years old)',
    grade_8: 'Grade 8 (13-14 years old)',
    grade_10: 'Grade 10 (15-16 years old)',
  };

  return `Simplify the following government text to ${levelDescriptions[targetLevel]} reading level.

Original text:
"${text}"

Instructions:
1. Replace complex words with simpler alternatives
2. Break long sentences into shorter ones (max 15 words per sentence)
3. Use active voice instead of passive voice
4. Remove jargon and bureaucratic language
5. Preserve ALL factual information and accuracy
6. Maintain the same meaning

Also identify difficult words that were simplified.

Return ONLY a JSON object with this exact format:
{
  "simplified": "simplified text here",
  "difficult_words": [
    {
      "word": "eligible",
      "explanation": "Qualified or allowed to receive something",
      "simpler_alternative": "qualified",
      "context_snippet": "eligible beneficiaries"
    }
  ],
  "confidence": 95
}

Note: confidence should be 0-100 (e.g., 95 for 95%)

Examples:

Original: "Eligible beneficiaries must submit supporting documentation within the stipulated timeframe to qualify for financial assistance."
Simplified: "You must send your documents before the deadline to receive government help."
Difficult words:
- "eligible" → "qualified" (Complex legal term)
- "beneficiaries" → "you" (Bureaucratic term)
- "supporting documentation" → "documents" (Formal phrase)
- "stipulated timeframe" → "deadline" (Complex phrase)
- "financial assistance" → "government help" (Formal term)

Original: "Applicants are required to furnish documentation verifying income eligibility."
Simplified: "You must show proof of your income."
Difficult words:
- "furnish" → "show" (Formal verb)
- "documentation" → "proof" (Bureaucratic term)
- "verifying" → "show" (Complex verb)

Return ONLY the JSON, no other text.`;
}



/**
 * Calculate Flesch Reading Ease scores
 * 
 * Formula: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
 * 
 * Score interpretation:
 * 90-100: Grade 5
 * 80-90: Grade 6
 * 70-80: Grade 7
 * 60-70: Grade 8-9
 * 50-60: Grade 10-12
 * 30-50: College
 * 0-30: College graduate
 */
function calculateReadabilityScores(originalText: string, simplifiedText: string): ReadabilityScore {
  const originalScore = calculateFleschScore(originalText);
  const simplifiedScore = calculateFleschScore(simplifiedText);
  
  const originalGrade = scoreToGrade(originalScore);
  const simplifiedGrade = scoreToGrade(simplifiedScore);
  
  return {
    original: originalScore,
    simplified: simplifiedScore,
    metric: 'flesch_reading_ease',
    improvement: `${originalGrade} → ${simplifiedGrade}`,
  };
}

/**
 * Calculate Flesch Reading Ease score for text
 */
function calculateFleschScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const syllables = countSyllables(text);
  
  if (sentences === 0 || words === 0) return 50;
  
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Count syllables in text (simplified algorithm)
 */
function countSyllables(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  let totalSyllables = 0;
  
  for (const word of words) {
    // Remove non-alphabetic characters
    const cleanWord = word.replace(/[^a-z]/g, '');
    if (cleanWord.length === 0) continue;
    
    // Count vowel groups
    const vowelGroups = cleanWord.match(/[aeiouy]+/g);
    let syllables = vowelGroups ? vowelGroups.length : 1;
    
    // Adjust for silent 'e'
    if (cleanWord.endsWith('e') && syllables > 1) {
      syllables--;
    }
    
    // Minimum 1 syllable per word
    totalSyllables += Math.max(1, syllables);
  }
  
  return totalSyllables;
}

/**
 * Convert Flesch score to grade level
 */
function scoreToGrade(score: number): string {
  if (score >= 90) return 'Grade 5';
  if (score >= 80) return 'Grade 6';
  if (score >= 70) return 'Grade 7';
  if (score >= 60) return 'Grade 8-9';
  if (score >= 50) return 'Grade 10-12';
  if (score >= 30) return 'College';
  return 'College Graduate';
}
