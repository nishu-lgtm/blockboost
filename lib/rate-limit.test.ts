import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "./rate-limit";

// Each test uses a unique key prefix so the shared in-memory Map
// across imports doesn't cause cross-test interference.

test("rateLimit: first request is always allowed", () => {
  // INTENT: a fresh key must never be blocked — blocking the very first
  // request would silently drop legitimate traffic with no recourse.
  const result = rateLimit("rl-test-fresh", 5, 60_000);
  assert.equal(result.ok, true);
});

test("rateLimit: requests up to the limit are all allowed", () => {
  // INTENT: the Nth request must still succeed. Off-by-one here would
  // drop the last legitimate request in a burst (e.g. the final ingest
  // call from a crawler that just hit the limit).
  const key = "rl-test-exact";
  const limit = 3;
  for (let i = 0; i < limit; i++) {
    const r = rateLimit(key, limit, 60_000);
    assert.equal(r.ok, true, `request ${i + 1}/${limit} should be allowed`);
  }
});

test("rateLimit: request beyond limit is blocked and returns retryAfter", () => {
  // INTENT: the rate limiter's only job is to return ok=false past the
  // limit and tell callers how long to wait. If retryAfter is missing or
  // zero the caller has no way to set Retry-After on the response.
  const key = "rl-test-over";
  const limit = 2;
  rateLimit(key, limit, 60_000);
  rateLimit(key, limit, 60_000);
  const blocked = rateLimit(key, limit, 60_000);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.ok(blocked.retryAfter > 0, "retryAfter must be positive seconds");
  }
});

test("rateLimit: different keys have independent buckets", () => {
  // INTENT: rate limiting key A must never bleed into key B. If buckets
  // were shared the first bot to hit the limit would block all others —
  // a catastrophic false-positive that would drop all valid ingest.
  const limit = 1;
  rateLimit("rl-test-iso-a", limit, 60_000); // exhaust key A
  const r = rateLimit("rl-test-iso-b", limit, 60_000); // key B must still be allowed
  assert.equal(r.ok, true);
});

// NOTE: window-expiry behaviour (bucket resets after windowMs) is not tested
// here because Date.now() has millisecond precision — two calls in the same
// event-loop tick return the same timestamp, making the test non-deterministic
// without a clock mock. The reset path is exercised by the in-memory sweep
// in lib/rate-limit.ts; trust the code over a flaky timing test (Rule 12).
