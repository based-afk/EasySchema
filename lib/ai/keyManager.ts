// ─── Groq API Key Rotation Manager ──────────────────────────────────────────
//
// Reads GROQ_KEY_1 … GROQ_KEY_4 from env and rotates automatically when
// rate-limit (429) or threshold conditions occur.
// ─────────────────────────────────────────────────────────────────────────────

export interface KeyState {
  key: string;
  index: number;
  usageCount: number;
  rateLimitedUntil: number; // epoch ms; 0 = not limited
}

const USAGE_ROTATE_THRESHOLD = 50; // rotate after N calls per key

// ─── Build key pool from env ─────────────────────────────────────────────────

function buildKeyPool(): KeyState[] {
  const pool: KeyState[] = [];
  for (let i = 1; i <= 4; i++) {
    const key = process.env[`GROQ_KEY_${i}`];
    if (key && key.trim()) {
      pool.push({
        key: key.trim(),
        index: i,
        usageCount: 0,
        rateLimitedUntil: 0,
      });
    }
  }
  return pool;
}

// ─── Singleton state ─────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __groqKeyPool: KeyState[] | undefined;
  // eslint-disable-next-line no-var
  var __groqCurrentKeyIdx: number | undefined;
}

function getPool(): KeyState[] {
  if (!global.__groqKeyPool || global.__groqKeyPool.length === 0) {
    global.__groqKeyPool = buildKeyPool();
    global.__groqCurrentKeyIdx = 0;
  }
  return global.__groqKeyPool;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the currently active API key.
 * Automatically skips keys that are rate-limited.
 */
export function getActiveKey(): string | null {
  const pool = getPool();
  if (pool.length === 0) return null;

  const now = Date.now();
  const startIdx = global.__groqCurrentKeyIdx ?? 0;

  // Try each key once starting from current
  for (let attempt = 0; attempt < pool.length; attempt++) {
    const idx = (startIdx + attempt) % pool.length;
    const keyState = pool[idx];

    if (keyState.rateLimitedUntil > now) continue; // skip rate-limited

    global.__groqCurrentKeyIdx = idx;
    return keyState.key;
  }

  // All keys rate-limited — return the one with smallest remaining wait
  const soonest = pool
    .slice()
    .sort((a, b) => a.rateLimitedUntil - b.rateLimitedUntil)[0];
  return soonest.key;
}

/**
 * Increment usage counter for the active key.
 * Triggers rotation after USAGE_ROTATE_THRESHOLD calls.
 */
export function recordKeyUsage(): void {
  const pool = getPool();
  if (pool.length === 0) return;

  const idx = global.__groqCurrentKeyIdx ?? 0;
  pool[idx].usageCount += 1;

  if (pool[idx].usageCount >= USAGE_ROTATE_THRESHOLD) {
    pool[idx].usageCount = 0;
    global.__groqCurrentKeyIdx = (idx + 1) % pool.length;
    console.log(
      `[KeyManager] Rotated to GROQ_KEY_${pool[global.__groqCurrentKeyIdx!].index} (usage threshold)`,
    );
  }
}

/**
 * Mark current key as rate-limited for the given duration (ms).
 * Automatically rotates to the next available key.
 */
export function markKeyRateLimited(durationMs: number = 60_000): void {
  const pool = getPool();
  if (pool.length === 0) return;

  const idx = global.__groqCurrentKeyIdx ?? 0;
  pool[idx].rateLimitedUntil = Date.now() + durationMs;
  console.warn(
    `[KeyManager] GROQ_KEY_${pool[idx].index} rate-limited for ${durationMs / 1000}s`,
  );

  // Rotate to next non-limited key
  const next = (idx + 1) % pool.length;
  global.__groqCurrentKeyIdx = next;
  console.log(`[KeyManager] Switched to GROQ_KEY_${pool[next].index}`);
}

/**
 * Returns true if at least one Groq key is configured.
 */
export function isGroqAvailable(): boolean {
  return getPool().length > 0;
}

/**
 * Returns a summary of all key states (without exposing the actual keys).
 */
export function getKeyPoolStatus(): {
  total: number;
  available: number;
  rateLimited: number;
}[] {
  const pool = getPool();
  const now = Date.now();
  return pool.map((k) => ({
    keyIndex: k.index,
    usageCount: k.usageCount,
    rateLimitedUntil:
      k.rateLimitedUntil > now
        ? new Date(k.rateLimitedUntil).toISOString()
        : null,
  })) as never;
}
