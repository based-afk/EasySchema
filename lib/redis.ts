// Redis connection singleton
// Gracefully degrades — if Redis is unavailable, the app continues without L2 cache.

import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | null | undefined;
  // eslint-disable-next-line no-var
  var __redisAttempted: boolean | undefined;
}

/**
 * Returns a shared Redis client, or null if Redis is not configured / unavailable.
 * Only attempts connection once to avoid repeated failures.
 */
export function getRedis(): Redis | null {
  if (global.__redisAttempted) return global.__redis ?? null;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("[Redis] REDIS_URL not set — L2 cache disabled");
    global.__redisAttempted = true;
    global.__redis = null;
    return null;
  }

  try {
    global.__redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
      retryStrategy(times) {
        // Only retry 3 times on initial connect, then give up
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
    });

    global.__redis.on("error", (err) => {
      console.warn("[Redis] Connection error:", err.message);
    });

    global.__redis.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });

    // Attempt connection
    global.__redis.connect().catch(() => {
      console.warn("[Redis] Could not connect — L2 cache disabled");
      global.__redis = null;
    });

    global.__redisAttempted = true;
    return global.__redis;
  } catch (err) {
    console.warn("[Redis] Init error:", err);
    global.__redisAttempted = true;
    global.__redis = null;
    return null;
  }
}
