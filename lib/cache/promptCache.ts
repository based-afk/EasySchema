// ─── DB-backed Prompt Cache ──────────────────────────────────────────────────
//
// Stores AI responses in the `ai_cache` PostgreSQL table.
// Cache key = sha256(normalized_prompt + task_type)
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "crypto";
import { query } from "../db";

export type CacheTaskType = "generate" | "analyze" | "refine" | "review";

// ─── Hash helper ──────────────────────────────────────────────────────────────

function buildHash(normalizedPrompt: string, taskType: CacheTaskType): string {
  return createHash("sha256")
    .update(`${taskType}::${normalizedPrompt}`)
    .digest("hex");
}

// ─── In-memory L1 cache (same process, 5-min TTL) ────────────────────────────

const L1_TTL_MS = 5 * 60 * 1000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const l1: Map<string, { data: any; ts: number }> = new Map();
let cacheSchemaReady = false;
let cacheSchemaInitPromise: Promise<void> | null = null;

function l1Get(hash: string): unknown | null {
  const entry = l1.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.ts > L1_TTL_MS) {
    l1.delete(hash);
    return null;
  }
  return entry.data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function l1Set(hash: string, data: any): void {
  l1.set(hash, { data, ts: Date.now() });
}

async function ensureCacheSchema(): Promise<void> {
  if (cacheSchemaReady) return;

  if (!cacheSchemaInitPromise) {
    cacheSchemaInitPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS ai_cache (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          prompt_hash   VARCHAR(64) NOT NULL,
          task_type     VARCHAR(20) NOT NULL,
          response_json JSONB NOT NULL,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (prompt_hash, task_type)
        )
      `);

      await query(
        `CREATE INDEX IF NOT EXISTS idx_ai_cache_hash_type ON ai_cache (prompt_hash, task_type)`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS idx_ai_cache_created ON ai_cache (created_at)`,
      );

      cacheSchemaReady = true;
      console.log("[PromptCache] ai_cache schema verified");
    })().catch((err) => {
      cacheSchemaInitPromise = null;
      throw err;
    });
  }

  await cacheSchemaInitPromise;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Check DB cache. Returns cached JSON or null.
 */
export async function promptCacheGet(
  normalizedPrompt: string,
  taskType: CacheTaskType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const hash = buildHash(normalizedPrompt, taskType);

  // L1 first
  const l1Hit = l1Get(hash);
  if (l1Hit) return l1Hit;

  try {
    await ensureCacheSchema();

    const result = await query<{ response_json: unknown }>(
      `SELECT response_json FROM ai_cache
       WHERE prompt_hash = $1 AND task_type = $2
       LIMIT 1`,
      [hash, taskType],
    );

    if (result.rowCount && result.rowCount > 0) {
      const data = result.rows[0].response_json;
      l1Set(hash, data);
      console.log(`[PromptCache] DB hit — ${taskType} ${hash.slice(0, 8)}`);
      return data;
    }
  } catch (err) {
    console.warn("[PromptCache] DB read error (non-fatal):", err);
  }

  return null;
}

/**
 * Write a result into the DB cache.
 */
export async function promptCacheSet(
  normalizedPrompt: string,
  taskType: CacheTaskType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): Promise<void> {
  const hash = buildHash(normalizedPrompt, taskType);
  l1Set(hash, data);

  try {
    await ensureCacheSchema();

    await query(
      `INSERT INTO ai_cache (prompt_hash, task_type, response_json, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (prompt_hash, task_type) DO UPDATE
         SET response_json = EXCLUDED.response_json,
             created_at    = NOW()`,
      [hash, taskType, JSON.stringify(data)],
    );
    console.log(`[PromptCache] DB written — ${taskType} ${hash.slice(0, 8)}`);
  } catch (err) {
    console.warn("[PromptCache] DB write error (non-fatal):", err);
  }
}

/**
 * Purge all cache entries older than the given number of days.
 */
export async function purgeOldCache(olderThanDays = 30): Promise<number> {
  try {
    await ensureCacheSchema();

    const res = await query(
      `DELETE FROM ai_cache WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'`,
    );
    return res.rowCount ?? 0;
  } catch (err) {
    console.warn("[PromptCache] Purge error:", err);
    return 0;
  }
}
