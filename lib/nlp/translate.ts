/**
 * Dialect-Aware Translation
 * 
 * Translates text to target language/dialect while preserving simplification level
 * Uses LangChain with OpenRouter for translation
 */

import { createStructuredModel, withRetry } from '@/lib/langchain/structured';
import { TranslationResultSchema, ModelPresets } from '@/lib/langchain';

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
  target_dialect?: string;
}

/**
 * Translate text to target language/dialect
 * 
 * @param text - Text to translate
 * @param targetLanguage - Target language code
 * @param targetDialect - Target dialect (optional)
 * @param preserveSimplification - Maintain simple language level
 * @returns Translation result
 * 
 * @example
 * ```typescript
 * const result = await translateToDialect(
 *   "You must send your documents before the deadline",
 *   "ms",
 *   "sabah",
 *   true
 * );
 * // {
 * //   translated: "Kau kena hantar dokumen kau sebelum tarikh akhir",
 * //   confidence: 0.92,
 * //   ...
 * // }
 * ```
 */
export async function translateToDialect(
  text: string,
  targetLanguage: string,
  targetDialect?: string,
  preserveSimplification: boolean = true
): Promise<TranslationResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  console.log(`[Translation] Translating to ${targetLanguage}${targetDialect ? ` (${targetDialect})` : ''}...`);

  try {
    // Use Trinity Mini for translation with structured output
    const model = withRetry(
      createStructuredModel(TranslationResultSchema, {
        name: 'translate_text',
        model: ModelPresets.TRINITY_MINI,
        temperature: 0.5, // Moderate creativity for natural translation
        maxTokens: 1000,
      })
    );

    const prompt = buildTranslationPrompt(text, targetLanguage, targetDialect, preserveSimplification);
    
    const structuredResult = await model.invoke([
      { role: 'user', content: prompt }
    ]);

    // Build result with all required fields
    const result: TranslationResult = {
      translated: structuredResult.translated,
      confidence: structuredResult.confidence,
      alternatives: structuredResult.alternatives,
      source_language: 'auto',
      target_language: targetLanguage,
      target_dialect: targetDialect,
    };
    
    console.log(`[Translation] ✅ Translation complete (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
    
    return result;
  } catch (error) {
    console.error('[Translation] ❌ Error:', error);
    
    // Fallback: Return original text
    return {
      translated: text,
      confidence: 0.5,
      source_language: 'unknown',
      target_language: targetLanguage,
      target_dialect: targetDialect,
    };
  }
}

/**
 * Build translation prompt for LLM
 */
function buildTranslationPrompt(
  text: string,
  targetLanguage: string,
  targetDialect?: string,
  preserveSimplification: boolean = true
): string {
  const languageNames: Record<string, string> = {
    en: 'English',
    ms: 'Malay',
    id: 'Indonesian',
    tl: 'Tagalog',
    ta: 'Tamil',
    zh: 'Chinese',
  };

  const targetLanguageName = languageNames[targetLanguage] || targetLanguage;
  const dialectInfo = targetDialect ? ` (${targetDialect} dialect)` : '';
  const simplificationNote = preserveSimplification 
    ? '\n- Maintain simple language level (Grade 5 reading level)'
    : '';

  return `Translate the following text to ${targetLanguageName}${dialectInfo}.

Original text:
"${text}"

Instructions:
1. Use ${targetLanguageName}${dialectInfo} vocabulary and grammar
2. Preserve all factual information and accuracy
3. Use natural, conversational tone${simplificationNote}
4. If dialect is specified, use dialect-specific words and expressions
5. Maintain the same meaning and intent

Return ONLY a JSON object with this exact format:
{
  "translated": "translated text here",
  "confidence": 95
}

Note: confidence should be 0-100 (e.g., 95 for 95%)

Examples:

English → Malay (Sabah dialect):
Original: "You must send your documents before the deadline to receive government help."
Translated: "Kau kena hantar dokumen kau sebelum tarikh akhir untuk dapat bantuan kerajaan."
(Uses "kau" instead of "anda", "kena" instead of "mesti" - Sabah informal style)

English → Malay (Kelantan dialect):
Original: "You must send your documents before the deadline."
Translated: "Demo kena hantar dokumen demo sebelum tarikh akhir."
(Uses "demo" instead of "anda" - Kelantan dialect)

Standard Malay → Malay (Sabah dialect):
Original: "Anda mesti menghantar dokumen anda."
Translated: "Kau kena hantar dokumen kau."

English → Tagalog (Cebuano):
Original: "Where are you going?"
Translated: "Asa ka paingon?"
(Cebuano dialect, not standard Tagalog "Saan ka pupunta?")

English → Chinese (Cantonese):
Original: "How are you?"
Translated: "你好嗎？" (lei5 hou2 maa3)
(Cantonese, not Mandarin "你好吗？")

Return ONLY the JSON, no other text.`;
}



/**
 * Get language display name
 */
export function getLanguageDisplayName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    ms: 'Malay',
    id: 'Indonesian',
    tl: 'Tagalog',
    ta: 'Tamil',
    zh: 'Chinese',
  };
  return names[code] || code;
}

/**
 * Get dialect display name
 */
export function getDialectDisplayName(dialect: string): string {
  const names: Record<string, string> = {
    kelantan: 'Kelantan',
    kelantanese: 'Kelantan',
    sabah: 'Sabah',
    sabahan: 'Sabah',
    terengganu: 'Terengganu',
    cebuano: 'Cebuano',
    ilocano: 'Ilocano',
    waray: 'Waray',
    bisaya: 'Bisaya',
    cantonese: 'Cantonese',
    hokkien: 'Hokkien',
    mandarin: 'Mandarin',
  };
  return names[dialect.toLowerCase()] || dialect;
}
