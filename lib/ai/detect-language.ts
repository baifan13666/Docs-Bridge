/**
 * Language & Dialect Detection with Vercel AI SDK
 * 
 * Uses generateText() with Output.object() for cleaner code with automatic:
 * - Retry logic
 * - Partial repair
 * - Type validation
 * - Parse error handling
 */

import { generateText, Output } from 'ai';
import { createModelWithHealing, ModelPresets } from './openrouter';
import { LanguageDetectionSchema, type LanguageDetection } from './schemas';

/**
 * Simple heuristic-based language detection as fallback
 */
function detectLanguageHeuristic(text: string): { language: 'en' | 'ms' | 'id' | 'tl' | 'ta' | 'zh'; confidence: number } {
  const lowerText = text.toLowerCase();
  
  // Chinese characters
  if (/[\u4e00-\u9fff]/.test(text)) {
    return { language: 'zh', confidence: 0.8 };
  }
  
  // Tamil characters
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return { language: 'ta', confidence: 0.8 };
  }
  
  // Malay common words
  const malayWords = ['saya', 'nak', 'yang', 'dengan', 'untuk', 'ada', 'tidak', 'ini', 'itu', 'ke'];
  const malayCount = malayWords.filter(word => lowerText.includes(word)).length;
  if (malayCount >= 2) {
    return { language: 'ms', confidence: 0.7 };
  }
  
  // Indonesian common words
  const indonesianWords = ['saya', 'yang', 'dengan', 'untuk', 'tidak', 'ini', 'itu', 'dari', 'pada'];
  const indonesianCount = indonesianWords.filter(word => lowerText.includes(word)).length;
  if (indonesianCount >= 2) {
    return { language: 'id', confidence: 0.7 };
  }
  
  // Tagalog common words
  const tagalogWords = ['ang', 'ng', 'sa', 'mga', 'na', 'ay', 'ko', 'mo', 'po'];
  const tagalogCount = tagalogWords.filter(word => lowerText.includes(word)).length;
  if (tagalogCount >= 2) {
    return { language: 'tl', confidence: 0.7 };
  }
  
  // Default to English
  return { language: 'en', confidence: 0.6 };
}

/**
 * Detect language and dialect from text
 * 
 * @param text - User input text
 * @returns Language detection result
 * 
 * @example
 * ```typescript
 * const detection = await detectLanguage("Sayo nak tahu pasal bantuan banjir");
 * // { language: 'ms', dialect: 'kelantan', confidence: 0.95, explanation: '...' }
 * ```
 */
export async function detectLanguage(text: string): Promise<LanguageDetection> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  console.log(`[Language Detection] Detecting language for: "${text.substring(0, 50)}..."`);

  try {
    const model = createModelWithHealing(ModelPresets.LFM_THINKING);
    
    // generateText with Output.object automatically handles:
    // - Retry on failure
    // - JSON repair (via response-healing plugin)
    // - Schema validation
    // - Type inference
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: LanguageDetectionSchema,
      }),
      prompt: `You are a language detection expert. Analyze the following text and detect its language and dialect.

Text: "${text}"

Supported languages (use these exact codes):
- English: "en"
- Malay: "ms" 
- Indonesian: "id"
- Tagalog: "tl"
- Tamil: "ta"
- Chinese: "zh"

Supported dialects (use null if no specific dialect):
- Malay: "kelantan", "sabah", "terengganu", "kelantanese"
- Tagalog: "cebuano", "ilocano", "waray", "bisaya"
- Chinese: "cantonese", "hokkien", "mandarin"

Rules:
1. If no specific dialect is detected, set "dialect" to null
2. Confidence should be a number between 0-100
3. Always provide an explanation

Respond with a JSON object containing: language, dialect, confidence, explanation.`,
      temperature: 0.3,
    });
    
    console.log(`[Language Detection] ✅ Detected: ${output.language}${output.dialect ? ` (${output.dialect})` : ''} (confidence: ${(output.confidence * 100).toFixed(1)}%)`);
    
    return output;
  } catch (error) {
    console.error('[Language Detection] ❌ Error:', error);
    
    // Try heuristic-based detection as fallback
    console.log('[Language Detection] Attempting heuristic fallback...');
    try {
      const heuristic = detectLanguageHeuristic(text);
      console.log(`[Language Detection] Heuristic result: ${heuristic.language} (confidence: ${(heuristic.confidence * 100).toFixed(1)}%)`);
      
      return {
        language: heuristic.language,
        dialect: null,
        confidence: heuristic.confidence,
        explanation: 'Detected using heuristic fallback due to API error',
      };
    } catch (heuristicError) {
      console.error('[Language Detection] Heuristic fallback also failed:', heuristicError);
    }
    
    // Final fallback: Return English with low confidence
    console.log('[Language Detection] Using final fallback: English');
    return {
      language: 'en' as const,
      dialect: null,
      confidence: 0.5,
      explanation: 'Failed to detect language, defaulting to English',
    };
  }
}
