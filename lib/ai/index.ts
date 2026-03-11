/**
 * Vercel AI SDK - Unified Exports
 * 
 * Cleaner alternative to LangChain with automatic:
 * - Retry logic
 * - Partial repair (response-healing plugin)
 * - Type validation via Zod
 * - Parse error handling
 */

// OpenRouter configuration
export { createOpenRouterProvider, createModelWithHealing, ModelPresets } from './openrouter';

// Schemas and types
export * from './schemas';

// NLP functions
export { detectLanguage } from './detect-language';
export { rewriteQuery, shouldRewriteQuery } from './query-rewrite';
export { summarizeText } from './summarize';
export { translateText } from './translate';
export { simplifyText } from './simplify';

// Re-export types for convenience
export type { QueryRewriteResult } from './query-rewrite';
export type { SummarizationResult, WordCount } from './summarize';
export type { TranslationResult, TranslationAlternative } from './translate';
export type { SimplificationResult, ReadabilityScore } from './simplify';
