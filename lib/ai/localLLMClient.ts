// ─── Local LLM Client ───────────────────────────────────────────────────────
//
// Wrapper for local LLM endpoints (Ollama, LM Studio, LocalAI, etc.)
// Implements the same interface as groqClient for seamless switching.
// ─────────────────────────────────────────────────────────────────────────────

import type { GroqMessage, GroqChatOptions } from "./groqClient";
import {
  stripMarkdownFences,
  repairTruncatedJson,
  extractJsonObject,
  validateJsonResponse,
} from "../utils/jsonValidator";

const DEFAULT_MODEL = "mistral";
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 1000;
const DEFAULT_TIMEOUT_MS = 25000;

/**
 * Create a local LLM client (Ollama-compatible)
 * URL should be something like: http://192.168.x.x:11434
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLocalLLMClient(): {
  chatJson<T = any>(
    messages: GroqMessage[],
    options?: GroqChatOptions,
  ): Promise<T | null>;
  isAvailable(): boolean;
} {
  const baseUrl = process.env.LOCAL_LLM_URL || "http://localhost:11434";
  const model = process.env.LOCAL_LLM_MODEL || DEFAULT_MODEL;

  return {
    chatJson,
    isAvailable,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function chatJson<T = any>(
    messages: GroqMessage[],
    options?: GroqChatOptions,
  ): Promise<T | null> {
    const temperature = options?.temperature ?? 0.3;
    const maxTokens = options?.maxTokens ?? 4096;

    // Add JSON instruction if requested
    let msgs = [...messages];
    if (options?.requireJson !== false) {
      const lastIdx = msgs.length - 1;
      msgs[lastIdx] = {
        ...msgs[lastIdx],
        content:
          msgs[lastIdx].content +
          "\n\nCRITICAL: Return ONLY valid JSON. No explanations, no markdown fences, no extra text outside the JSON object.",
      };
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await callLocalLLM(baseUrl, model, msgs, {
          temperature,
          max_tokens: maxTokens,
        });

        // Parse and validate the response
        let cleaned = stripMarkdownFences(response.message.content);

        // Try to validate raw first
        const validated = validateJsonResponse<T>(cleaned);
        if (validated !== null) return validated;

        // Try repair if validation failed
        const repaired = repairTruncatedJson(cleaned);
        if (repaired) {
          const revalidated = validateJsonResponse<T>(repaired);
          if (revalidated !== null) return revalidated;
        }

        // Tolerant fallback: extract first JSON object/array from mixed text.
        const extracted = extractJsonObject(cleaned) as T | null;
        if (extracted !== null) return extracted;

        // Parsing failed: do not keep regenerating large responses; fail fast.
        return null;
      } catch (error) {
        lastError = error as Error;

        // If it's a network error, retry with backoff
        if (
          lastError.message.includes("fetch") ||
          lastError.message.includes("connection") ||
          lastError.message.includes("ECONNREFUSED")
        ) {
          if (attempt < MAX_RETRIES - 1) {
            const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
            await sleep(backoff);
            continue;
          }
        }

        // For other errors, log and retry
        if (attempt < MAX_RETRIES - 1) {
          const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
          await sleep(backoff);
          continue;
        }

        break;
      }
    }

    console.error(
      `[LocalLLM] Failed after ${MAX_RETRIES} retries:`,
      lastError?.message,
    );
    return null;
  }

  function isAvailable(): boolean {
    // For local LLM, assume available if URL is configured
    // A more robust check would be async, but keep sync for interface compatibility
    return (
      baseUrl !== "http://localhost:11434" ||
      process.env.LOCAL_LLM_URL !== undefined
    );
  }
}

/**
 * Call the local LLM endpoint (Ollama-compatible API)
 */
async function callLocalLLM(
  baseUrl: string,
  model: string,
  messages: GroqMessage[],
  options: { temperature: number; max_tokens: number },
): Promise<{ message: { content: string } }> {
  const url = `${baseUrl}/api/chat`;
  const timeoutMs = Number(
    process.env.LOCAL_LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  );

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature,
      stream: false,
      format: "json",
      options: {
        num_predict: options.max_tokens,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Local LLM error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
