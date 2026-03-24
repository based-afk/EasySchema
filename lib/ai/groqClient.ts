// ─── Groq Client Wrapper ─────────────────────────────────────────────────────
//
// Wraps the groq-sdk with key rotation, retry logic, and JSON enforcement.
// Model: llama3-70b-8192 (configurable via GROQ_MODEL env var)
// ─────────────────────────────────────────────────────────────────────────────

import Groq from "groq-sdk";
import {
  getActiveKey,
  recordKeyUsage,
  markKeyRateLimited,
  isGroqAvailable,
} from "./keyManager";
import { validateJsonResponse } from "../utils/jsonValidator";
import {
  stripMarkdownFences,
  repairTruncatedJson,
} from "../utils/jsonValidator";

export { isGroqAvailable };

const DEFAULT_MODEL = "llama3-70b-8192";
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** If true, the system prompt will instruct strict JSON-only output */
  requireJson?: boolean;
}

// ─── Singleton client factory ─────────────────────────────────────────────────

function makeClient(apiKey: string): Groq {
  return new Groq({ apiKey });
}

// ─── Parse retry-after from Groq 429 header/message ──────────────────────────

function parseRetryAfter(err: unknown): number {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    // groq-sdk puts the header value in e.headers
    const headers = e["headers"] as Record<string, string> | undefined;
    if (headers?.["retry-after"]) {
      const secs = parseFloat(headers["retry-after"]);
      if (!isNaN(secs)) return Math.ceil(secs * 1000);
    }
    // Fallback: scan message string
    const msg = String(e["message"] ?? "");
    const match = msg.match(/retry.{0,10}?(\d+(?:\.\d+)?)\s*s/i);
    if (match) return Math.ceil(parseFloat(match[1]) * 1000);
  }
  return 60_000; // default 60s penalty
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Core chat function ───────────────────────────────────────────────────────

export async function groqChat(
  messages: GroqMessage[],
  options: GroqChatOptions = {},
): Promise<string | null> {
  if (!isGroqAvailable()) {
    console.error("[GroqClient] No Groq API keys configured.");
    return null;
  }

  const model = process.env.GROQ_MODEL ?? DEFAULT_MODEL;
  const { temperature = 0.3, maxTokens = 4096, requireJson = true } = options;

  // Inject JSON enforcement into system message if required
  let finalMessages = [...messages];
  if (requireJson) {
    const systemIdx = finalMessages.findIndex((m) => m.role === "system");
    const jsonInstruction =
      "\n\nCRITICAL: Return ONLY valid JSON. No explanations, no markdown fences, no extra text outside the JSON object.";
    if (systemIdx >= 0) {
      finalMessages[systemIdx] = {
        ...finalMessages[systemIdx],
        content: finalMessages[systemIdx].content + jsonInstruction,
      };
    } else {
      finalMessages = [
        {
          role: "system",
          content:
            "You are a precise JSON-generating assistant." + jsonInstruction,
        },
        ...finalMessages,
      ];
    }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const apiKey = getActiveKey();
    if (!apiKey) {
      console.error("[GroqClient] No available API key.");
      return null;
    }

    try {
      const client = makeClient(apiKey);
      const completion = await client.chat.completions.create({
        model,
        messages: finalMessages as Groq.Chat.ChatCompletionMessageParam[],
        temperature,
        max_tokens: maxTokens,
      });

      recordKeyUsage();

      const content = completion.choices[0]?.message?.content ?? null;
      return content;
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      const status = e["status"] as number | undefined;

      if (status === 429) {
        const waitMs = parseRetryAfter(err);
        markKeyRateLimited(waitMs);
        console.warn(
          `[GroqClient] Rate limited on attempt ${attempt + 1}. Waiting ${waitMs}ms before retry.`,
        );
        await sleep(waitMs > 30_000 ? BASE_BACKOFF_MS * (attempt + 1) : waitMs);
        continue;
      }

      // Non-retryable errors
      console.error(`[GroqClient] Error on attempt ${attempt + 1}:`, err);
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_BACKOFF_MS * (attempt + 1));
      }
    }
  }

  console.error("[GroqClient] All retry attempts exhausted.");
  return null;
}

// ─── JSON-extracting wrapper ──────────────────────────────────────────────────

/**
 * Call Groq and return a parsed JSON object. Returns null on failure.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function groqChatJson<T = any>(
  messages: GroqMessage[],
  options: GroqChatOptions = {},
): Promise<T | null> {
  const raw = await groqChat(messages, { ...options, requireJson: true });
  if (!raw) return null;

  const cleaned = stripMarkdownFences(raw);
  const validated = validateJsonResponse<T>(cleaned);
  if (validated !== null) return validated;

  const repaired = repairTruncatedJson(cleaned);
  if (repaired) {
    const revalidated = validateJsonResponse<T>(repaired);
    if (revalidated !== null) return revalidated;
  }

  console.warn(
    "[GroqClient] Could not parse JSON from response:",
    raw.slice(0, 300),
  );
  return null;
}
