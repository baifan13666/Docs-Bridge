/**
 * Language & Dialect Detection
 * 
 * Uses LFM 2.5 1.2B Thinking model for fast language and dialect detection
 * Refactored to use LangChain structured output with Zod schemas
 */

import { createStructuredModel, withRetry, LanguageDetectionSchema } from '@/lib/langchain';
import { ModelPresets } from '@/lib/langchain/openrouter';

// Export type from schema
export type { LanguageDetection } from '@/lib/langchain';

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
export async function detectLanguage(text: string) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  console.log(`[Language Detection] Detecting language for: "${text.substring(0, 50)}..."`);

  try {
    // Create structured model with LFM Thinking
    const structuredModel = withRetry(
      createStructuredModel(LanguageDetectionSchema, {
        name: "detect_language",
        model: ModelPresets.LFM_THINKING,
        temperature: 0.3, // Low for consistent classification
        maxTokens: 200,   // Short responses
        strict: false,    // OpenRouter compatibility
      })
    );

    const prompt = buildDetectionPrompt(text);
    
    // Invoke with structured output - automatic parsing and validation!
    const result = await structuredModel.invoke([
      { role: 'user', content: prompt }
    ]);
    
    console.log(`[Language Detection] ✅ Detected: ${result.language}${result.dialect ? ` (${result.dialect})` : ''} (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
    
    return result;
  } catch (error) {
    console.error('[Language Detection] ❌ Error:', error);
    
    // Fallback: Return English with low confidence
    return {
      language: 'en' as const,
      dialect: null,
      confidence: 0.5,
      explanation: 'Failed to detect language, defaulting to English',
    };
  }
}

/**
 * Build detection prompt for LLM
 */
function buildDetectionPrompt(text: string): string {
  return `Detect the language and dialect of the following text.

Text: "${text}"

Return ONLY a JSON object with this exact format:
{
  "language": "ms",
  "dialect": "sabah",
  "confidence": 95,
  "explanation": "Detected Malay language with Sabah dialect based on vocabulary and grammar patterns."
}

Supported languages:
- English (en)
- Malay (ms)
- Indonesian (id)
- Tagalog (tl)
- Tamil (ta)
- Chinese (zh)

Supported dialects:
- Malay: kelantan, sabah, terengganu, kelantanese
- Tagalog: cebuano, ilocano, waray, bisaya
- Chinese: cantonese, hokkien, mandarin

If no specific dialect is detected, set "dialect" to null.
Confidence should be 0-100 (will be normalized to 0-1).
Return ONLY the JSON, no other text.`;
}
