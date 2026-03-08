/**
 * OpenRouter + LangChain Configuration
 * 
 * This module provides utilities for initializing LangChain models with OpenRouter.
 * It supports multiple API keys for load balancing and rate limit management.
 */

import { ChatOpenAI } from "@langchain/openai";

/**
 * Available OpenRouter API keys from environment variables
 * Keys are loaded from OPEN_ROUTER_KEY_1 through OPEN_ROUTER_KEY_20
 * This function is called each time to ensure env vars are loaded
 */
function getAvailableKeys(): string[] {
  return Array.from({ length: 20 }, (_, i) => 
    process.env[`OPEN_ROUTER_KEY_${i + 1}`]
  ).filter(Boolean) as string[];
}

/**
 * OpenRouter API base URL
 */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Get a random OpenRouter API key for load balancing
 */
function getRandomOpenRouterKey(): string {
  const OPENROUTER_KEYS = getAvailableKeys();
  if (OPENROUTER_KEYS.length === 0) {
    throw new Error("No OpenRouter API keys found in environment variables");
  }
  const randomIndex = Math.floor(Math.random() * OPENROUTER_KEYS.length);
  return OPENROUTER_KEYS[randomIndex];
}

/**
 * Get a specific OpenRouter API key by index (1-20)
 */
function getOpenRouterKey(index: number): string {
  if (index < 1 || index > 20) {
    throw new Error("Key index must be between 1 and 20");
  }
  const key = process.env[`OPEN_ROUTER_KEY_${index}`];
  if (!key) {
    throw new Error(`OPEN_ROUTER_KEY_${index} not found in environment variables`);
  }
  return key;
}

/**
 * Model configuration options
 */
export interface ModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  apiKey?: string; // Optional: specify a key, otherwise random key is used
}

/**
 * Create a ChatOpenAI instance configured for OpenRouter
 * 
 * @example
 * ```typescript
 * // Using default random key
 * const model = createOpenRouterModel({
 *   model: "anthropic/claude-sonnet-4.5",
 *   temperature: 0.7,
 *   maxTokens: 2048
 * });
 * 
 * // Using specific key
 * const model = createOpenRouterModel({
 *   model: "openai/gpt-4o",
 *   apiKey: process.env.OPEN_ROUTER_KEY_1
 * });
 * ```
 */
export function createOpenRouterModel(config: ModelConfig) {
  const {
    model,
    temperature = 0.7,
    maxTokens = 2048,
    topP,
    frequencyPenalty,
    presencePenalty,
    apiKey
  } = config;

  return new ChatOpenAI({
    model,
    temperature,
    maxTokens,
    topP,
    frequencyPenalty,
    presencePenalty,
    configuration: {
      apiKey: apiKey || getRandomOpenRouterKey(),
      baseURL: OPENROUTER_BASE_URL,
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
 * Quick model creation functions
 */
export const Models = {
  /**
   * LFM 2.5 1.2B Thinking - Fast detection model
   * Use for: Language detection, dialect detection, classification tasks
   * Speed: Very fast (~100-200ms)
   * Context: 32,768 tokens
   */
  lfmThinking: (config?: Partial<ModelConfig>) =>
    createOpenRouterModel({
      model: ModelPresets.LFM_THINKING,
      temperature: 0.3,
      maxTokens: 200,
      ...config,
    }),

  /**
   * Trinity Large - Main RAG model (Standard mode)
   * Use for: Complex RAG answers, reasoning, multi-document synthesis
   * Speed: Medium (~1-3 seconds)
   * Context: 8,192 tokens
   * Best accuracy and reasoning capabilities
   */
  trinityLarge: (config?: Partial<ModelConfig>) =>
    createOpenRouterModel({
      model: ModelPresets.TRINITY_LARGE,
      temperature: 0.7,
      maxTokens: 2048,
      ...config,
    }),

  /**
   * Trinity Mini - Fast RAG model (Mini mode) + NLP tasks
   * Use for: Fast RAG answers, translation, simplification, summarization
   * Speed: Fast (~500ms-1.5s)
   * Context: 8,192 tokens
   * Good balance of speed and quality
   */
  trinityMini: (config?: Partial<ModelConfig>) =>
    createOpenRouterModel({
      model: ModelPresets.TRINITY_MINI,
      temperature: 0.7,
      maxTokens: 2048,
      ...config,
    }),
};

/**
 * Utility functions
 */
export const OpenRouterUtils = {
  /**
   * Get all available API keys
   */
  getAvailableKeys: () => getAvailableKeys(),

  /**
   * Get number of available API keys
   */
  getKeyCount: () => getAvailableKeys().length,

  /**
   * Get a random key (for manual use)
   */
  getRandomKey: getRandomOpenRouterKey,

  /**
   * Get a specific key by index
   */
  getKey: getOpenRouterKey,
};
