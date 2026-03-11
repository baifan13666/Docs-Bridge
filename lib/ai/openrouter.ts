/**
 * OpenRouter + Vercel AI SDK Configuration
 * 
 * Cleaner alternative to LangChain with automatic:
 * - Retry logic
 * - Partial repair (response-healing plugin)
 * - Type validation via Zod
 * - Parse error handling
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';

/**
 * Get a random OpenRouter API key for load balancing
 */
function getRandomOpenRouterKey(): string {
  const keys = Array.from({ length: 20 }, (_, i) => 
    process.env[`OPEN_ROUTER_KEY_${i + 1}`]
  ).filter(Boolean) as string[];
  
  if (keys.length === 0) {
    throw new Error("No OpenRouter API keys found in environment variables");
  }
  
  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex];
}

/**
 * Create OpenRouter provider instance with response healing
 * Response healing automatically repairs malformed JSON
 */
export function createOpenRouterProvider() {
  return createOpenRouter({
    apiKey: getRandomOpenRouterKey(),
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'DocsBridge',
    },
  });
}

/**
 * Available free model presets
 */
export const ModelPresets = {
  // Detection model (fast classification)
  LFM_THINKING: "liquid/lfm-2.5-1.2b-thinking:free",
  
  // RAG models
  TRINITY_LARGE: "arcee-ai/trinity-large-preview:free",
  TRINITY_MINI: "arcee-ai/trinity-mini:free",
} as const;

/**
 * Create a model with response healing plugin
 * This automatically repairs malformed JSON responses
 */
export function createModelWithHealing(modelId: string) {
  const openrouter = createOpenRouterProvider();
  
  return openrouter(modelId, {
    plugins: [{ id: 'response-healing' }],
  });
}
