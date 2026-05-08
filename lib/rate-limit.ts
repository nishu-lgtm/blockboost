/**
 * Lightweight in-memory IP rate limiter.
 *
 * Note: Vercel serverless functions can have multiple instances. This limiter
 * is per-instance, so a determined attacker could bypass it via concurrent
 * cold starts. Sufficient for casual abuse (credential stuffing, signup bots).
 * For stronger protection, swap to Upstash Redis or @vercel/kv with the same
 * `check()` interface.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Sweep every 5 minutes to keep the map bounded.
let lastSweep = Date.now();
function sweepIfNeeded() {
  if (Date.now() - lastSweep < 5 * 60 * 1000) return;
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key);
  }
  lastSweep = now;
}

/**
 * Check if `key` may proceed under the given budget. Increments the bucket if
 * allowed.  Returns `{ ok: false, retryAfter }` when over the limit.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  sweepIfNeeded();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { ok: true };
}

/** Best-effort client IP extraction from Next.js Request. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}
