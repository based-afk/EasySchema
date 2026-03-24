// ─── Tiered Cache System ────────────────────────────────────────────────────
//
// L1: In-memory Map    — same process, 5-min TTL (deduplicates rapid re-clicks)
// L2: Redis            — cross-session, 24-72h TTL (survives restarts)
// L3: Domain Blueprints — static, infinite TTL (zero API calls)
//
// Flow:  L3 check → L1 check → L2 check → API call → write L1+L2
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "crypto";
import { getRedis } from "./redis";
import { matchBlueprint, normalizePrompt } from "./domain-blueprints";

export type UnifiedMode =
  | "analyze"
  | "refine"
  | "review"
  | "generate"
  | "analyze_and_refine"
  | "review_and_generate";

// ─── L1: In-memory cache ────────────────────────────────────────────────────

const L1_TTL = 5 * 60 * 1000; // 5 minutes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const l1Cache = new Map<string, { result: any; timestamp: number }>();

// ─── L2: Redis TTLs per mode ────────────────────────────────────────────────

const L2_TTL_SECONDS: Record<UnifiedMode, number> = {
  analyze: 6 * 3600, //  6 hours
  refine: 12 * 3600, // 12 hours
  review: 6 * 3600, //  6 hours
  generate: 72 * 3600, // 72 hours (schemas are expensive, cache longer)
  analyze_and_refine: 6 * 3600, //  6 hours
  review_and_generate: 24 * 3600, // 24 hours
};

// ─── Cache Key ──────────────────────────────────────────────────────────────

/**
 * Build a normalized, deterministic cache key.
 * Strips filler words and sorts terms so semantically identical prompts
 * ("e-commerce with users and products" vs "products and users e-commerce")
 * produce the same key.
 */
export function buildCacheKey(mode: UnifiedMode, input: string): string {
  const normalized = normalizePrompt(input);
  return createHash("md5").update(`${mode}::${normalized}`).digest("hex");
}

// ─── Tiered lookup ──────────────────────────────────────────────────────────

export interface CacheResult {
  /** The cached data, or null if miss */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any | null;
  /** Which tier served the result */
  tier: "L1" | "L2" | "L3" | "miss";
}

/**
 * Look up a cached result through all 3 tiers.
 * Checks L3 (blueprints) first, then L1 (memory), then L2 (Redis).
 */
export async function cacheGet(
  mode: UnifiedMode,
  rawInput: string,
): Promise<CacheResult> {
  // ── L3: Domain blueprints (only for "generate" mode) ──
  if (mode === "generate" || mode === "review_and_generate") {
    const blueprint = matchBlueprint(rawInput);
    if (blueprint) {
      return { data: blueprint, tier: "L3" };
    }
  }

  const key = buildCacheKey(mode, rawInput);

  // ── L1: In-memory ──
  const l1 = l1Cache.get(key);
  if (l1 && Date.now() - l1.timestamp < L1_TTL) {
    console.log(`[Cache L1 hit] ${mode}`);
    return { data: l1.result, tier: "L1" };
  }

  // ── L2: Redis ──
  try {
    const redis = getRedis();
    if (redis) {
      const raw = await redis.get(`easyschema:${mode}:${key}`);
      if (raw) {
        console.log(`[Cache L2 hit] ${mode}`);
        const parsed = JSON.parse(raw);
        // Promote to L1
        l1Cache.set(key, { result: parsed, timestamp: Date.now() });
        return { data: parsed, tier: "L2" };
      }
    }
  } catch (err) {
    console.warn("[Cache L2] Redis get error:", err);
  }

  return { data: null, tier: "miss" };
}

// ─── Write-through ──────────────────────────────────────────────────────────

/**
 * Write a result to both L1 and L2 caches.
 */
export async function cacheSet(
  mode: UnifiedMode,
  rawInput: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any,
): Promise<void> {
  const key = buildCacheKey(mode, rawInput);

  // L1: always write
  l1Cache.set(key, { result, timestamp: Date.now() });

  // L2: write to Redis (fire-and-forget)
  try {
    const redis = getRedis();
    if (redis) {
      const ttl = L2_TTL_SECONDS[mode];
      await redis.setex(
        `easyschema:${mode}:${key}`,
        ttl,
        JSON.stringify(result),
      );
      console.log(`[Cache L2 write] ${mode} (TTL: ${ttl}s)`);
    }
  } catch (err) {
    console.warn("[Cache L2] Redis set error:", err);
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

/** Clear L1 cache (useful for testing) */
export function clearL1Cache(): void {
  l1Cache.clear();
}

/** Get L1 cache stats */
export function getL1Stats(): { size: number; entries: string[] } {
  return {
    size: l1Cache.size,
    entries: Array.from(l1Cache.keys()),
  };
}
