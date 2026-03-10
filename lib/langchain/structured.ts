/**
 * Structured Model Factory for OpenRouter
 * 
 * Creates models with structured output using jsonMode (not jsonSchema)
 * for better compatibility with OpenRouter models
 */

import { z } from "zod";
import { createOpenRouterModel, type ModelConfig } from "./openrouter";

/**
 * Create a model with structured output (OpenRouter-compatible)
 * 
 * IMPORTANT: Uses jsonMode (not jsonSchema) for OpenRouter compatibility
 * 
 * @param schema - Zod schema for output validation
 * @param config - Model configuration
 * @returns Model with structured output
 * 
 * @example
 * ```typescript
 * const model = createStructuredModel(LanguageDetectionSchema, {
 *   name: "detect_language",
 *   model: "liquid/lfm-2.5-1.2b-thinking:free",
 *   temperature: 0.3,
 *   maxTokens: 200,
 * });
 * 
 * const result = await model.invoke([
 *   { role: 'user', content: 'Detect language: Saya nak pergi kedai' }
 * ]);
 * // result is typed and validated!
 * ```
 */
export function createStructuredModel<T extends z.ZodType>(
  schema: T,
  config: ModelConfig & {
    name: string;
  }
) {
  const { name, ...modelConfig } = config;
  
  const model = createOpenRouterModel(modelConfig);
  
  return model.withStructuredOutput(schema, {
    name,
    method: "jsonMode", // More forgiving than jsonSchema for OpenRouter
    // Note: strict parameter not supported with jsonMode
  });
}

/**
 * Add retry logic for rate limiting
 * 
 * Handles 429 errors with exponential backoff
 * 
 * @param model - Model to add retry logic to
 * @returns Model with retry logic
 * 
 * @example
 * ```typescript
 * const model = createStructuredModel(schema, config);
 * const modelWithRetry = withRetry(model);
 * ```
 */
export function withRetry<T>(model: T): T {
  return (model as any).withRetry({
    stopAfterAttempt: 3,
    onFailedAttempt: (error: any) => {
      if (error.message?.includes('429')) {
        // Exponential backoff for rate limits
        console.warn(`[Retry] Rate limited, attempt ${error.attemptNumber}, backing off...`);
        return { 
          delay: Math.pow(2, error.attemptNumber) * 1000 
        };
      }
      // For other errors, use default retry behavior
      return {};
    },
  });
}
