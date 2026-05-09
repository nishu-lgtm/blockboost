/**
 * AI response cache. Identical prompts produce identical answers (when the
 * model is deterministic enough), so cache them to slash repeat costs.
 *
 * Two backends, transparently selected:
 *   1. Upstash Redis if UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *      are set (recommended for prod — works across serverless instances).
 *   2. In-memory Map otherwise (per-instance, OK for dev or single-region).
 *
 * Keys are SHA-256 of (model + temperature + serialised messages) so cache
 * collisions across different prompts are impossible.
 */

import crypto from "crypto";

interface CacheEntry {
  value: string;
  expiresAt: number;
}

// ─── In-memory fallback ────────────────────────────────────────────────────────

const memoryCache = new Map<string, CacheEntry>();
let lastSweep = Date.now();

function sweep() {
  if (Date.now() - lastSweep < 5 * 60 * 1000) return;
  const now = Date.now();
  for (const [k, v] of memoryCache) {
    if (v.expiresAt < now) memoryCache.delete(k);
  }
  lastSweep = now;
}

// ─── Upstash Redis (REST) ──────────────────────────────────────────────────────

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_ENABLED = !!(REDIS_URL && REDIS_TOKEN);

async function redisGet(key: string): Promise<string | null> {
  if (!REDIS_ENABLED) return null;
  try {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result: string | null };
    return data.result ?? null;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: string, ttlSec: number): Promise<void> {
  if (!REDIS_ENABLED) return;
  try {
    await fetch(
      `${REDIS_URL}/setex/${encodeURIComponent(key)}/${ttlSec}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`,
          "Content-Type": "text/plain",
        },
        body: value,
      }
    );
  } catch {
    // Cache failures must never break the request flow.
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface CacheKey {
  model: string;
  temperature?: number;
  messages: Array<{ role: string; content: string }>;
  /** Optional namespace to prevent cross-feature collisions. */
  feature?: string;
}

export function buildCacheKey(input: CacheKey): string {
  const stable = JSON.stringify({
    f: input.feature ?? "",
    m: input.model,
    t: input.temperature ?? 0,
    msgs: input.messages,
  });
  return `llm:${crypto.createHash("sha256").update(stable).digest("hex")}`;
}

export async function cacheGet(key: string): Promise<string | null> {
  // Try redis first, then memory
  const fromRedis = await redisGet(key);
  if (fromRedis !== null) return fromRedis;

  sweep();
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSec = 24 * 60 * 60
): Promise<void> {
  await redisSet(key, value, ttlSec);
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

/**
 * Convenience wrapper: returns cached value if hit, otherwise calls `compute`,
 * stores the result, and returns it.
 */
export async function withCache<T>(
  key: string,
  ttlSec: number,
  compute: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet(key);
  if (cached !== null) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // Stale or corrupted entry — fall through and recompute
    }
  }
  const fresh = await compute();
  await cacheSet(key, JSON.stringify(fresh), ttlSec);
  return fresh;
}
