// ─── AI Client Factory ──────────────────────────────────────────────────────
//
// Abstraction layer that returns either Groq or Local LLM client based on config.
// Both clients implement the same interface, so existing code is fully compatible.
// ─────────────────────────────────────────────────────────────────────────────

import type { GroqMessage, GroqChatOptions } from "./groqClient";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AIClient {
  chatJson<T = any>(
    messages: GroqMessage[],
    options?: GroqChatOptions,
  ): Promise<T | null>;
  isAvailable(): boolean;
}

export type AIProvider = "groq" | "local";

/**
 * Get the configured AI provider from environment
 * Defaults to "groq" for backwards compatibility
 */
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER as AIProvider;
  return provider === "local" ? "local" : "groq";
}

/**
 * Factory function that returns the appropriate client
 * Lazy-loads the client only when needed
 */
let cachedClient: AIClient | null = null;

export function getAIClient(): AIClient {
  // Return cached client if already initialized
  if (cachedClient) {
    return cachedClient;
  }

  const provider = getAIProvider();

  if (provider === "local") {
    const { createLocalLLMClient } = require("./localLLMClient");
    cachedClient = createLocalLLMClient();
  } else {
    // Default: Groq (backwards compatible)
    const { groqChatJson, isGroqAvailable } = require("./groqClient");
    cachedClient = {
      chatJson: groqChatJson,
      isAvailable: isGroqAvailable,
    } as AIClient;
  }

  return (
    cachedClient ?? { chatJson: async () => null, isAvailable: () => false }
  );
}

/**
 * Check if the current AI provider is available
 */
export function isAIProviderAvailable(): boolean {
  const client = getAIClient();
  return client.isAvailable();
}

/**
 * Reset cache (useful for testing or switching providers at runtime)
 */
export function resetAIClientCache(): void {
  cachedClient = null;
}
