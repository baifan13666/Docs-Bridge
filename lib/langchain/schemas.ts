/**
 * Zod Schemas for LangChain Structured Output
 * 
 * OpenRouter-compatible schemas with flexible validation
 */

import { z } from "zod";

/**
 * Helper: Flexible confidence parsing
 * Handles: 92, 0.92, "92%", etc.
 */
const confidenceSchema = z.coerce
  .number()
  .min(0)
  .max(100)
  .transform(v => v > 1 ? v / 100 : v);

/**
 * Language Detection Schema
 */
export const LanguageDetectionSchema = z.object({
  language: z.enum(['en', 'ms', 'id', 'tl', 'ta', 'zh']),
  dialect: z.string().nullable(),
  confidence: confidenceSchema,
  explanation: z.string(),
});

/**
 * Dialect Normalization Schemas
 */
export const NormalizationChangeSchema = z.object({
  from: z.string(),
  to: z.string(),
  reason: z.string(),
});

export const NormalizationResultSchema = z.object({
  normalized: z.string(),
  changes: z.array(NormalizationChangeSchema),
  confidence: confidenceSchema,
  should_normalize: z.boolean(),
});

/**
 * Text Simplification Schemas
 */
export const DifficultWordSchema = z.object({
  word: z.string(),
  explanation: z.string(),
  simpler_alternative: z.string(),
  // Changed from position (unreliable) to context snippet
  context_snippet: z.string().optional(),
});

export const SimplificationResultSchema = z.object({
  simplified: z.string(),
  difficult_words: z.array(DifficultWordSchema),
  confidence: confidenceSchema,
});

/**
 * Summarization Schema
 */
export const SummarizationResultSchema = z.object({
  bullet_points: z.array(z.string()),
  key_actions: z.array(z.string()),
  confidence: confidenceSchema,
});

/**
 * Translation Schema
 */
export const TranslationResultSchema = z.object({
  translated: z.string(),
  confidence: confidenceSchema,
  alternatives: z.array(z.object({
    text: z.string(),
    confidence: confidenceSchema,
  })).optional(),
});

/**
 * Query Rewriting Schema
 */
export const QueryRewriteSchema = z.object({
  rewritten: z.string(),
  added_keywords: z.array(z.string()),
  reasoning: z.string(),
  confidence: confidenceSchema,
});

/**
 * Export inferred types
 */
export type LanguageDetection = z.infer<typeof LanguageDetectionSchema>;
export type NormalizationChange = z.infer<typeof NormalizationChangeSchema>;
export type NormalizationResult = z.infer<typeof NormalizationResultSchema>;
export type DifficultWord = z.infer<typeof DifficultWordSchema>;
export type SimplificationResult = z.infer<typeof SimplificationResultSchema>;
export type SummarizationResult = z.infer<typeof SummarizationResultSchema>;
export type TranslationResult = z.infer<typeof TranslationResultSchema>;
export type QueryRewriteResult = z.infer<typeof QueryRewriteSchema>;
