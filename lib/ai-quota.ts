/**
 * Per-user AI-action quota by plan. Prevents one FREE user from racking up
 * $50/day in copilot calls, and enforces fair usage across paid plans.
 *
 * Uses the existing in-memory rate limiter (lib/rate-limit). Counts AI
 * actions per UTC day. When the user upgrades, the new quota takes effect
 * on next call (no need to flush).
 *
 * Endpoints to gate (call `consumeAiQuota` at start of handler):
 *   - /api/copilot/chat
 *   - /api/briefs/generate
 *   - /api/social/replies?action=generate
 *   - /api/audit/run
 *   - /api/citations/[projectId] (hallucination check)
 *
 * Public/unauth endpoints already rate-limit by IP — those don't use this.
 */
import { rateLimit } from "@/lib/rate-limit";

type Plan = "FREE" | "STARTER" | "GROWTH" | "AGENCY" | "ENTERPRISE";

// Daily quota of AI-driven actions per plan.
const QUOTAS: Record<Plan, number> = {
  FREE: 10,
  STARTER: 50,
  GROWTH: 500,
  AGENCY: 2000,
  ENTERPRISE: 100_000, // effectively unlimited
};

const DAY_MS = 24 * 60 * 60 * 1000;

export interface QuotaResult {
  ok: boolean;
  retryAfterSec?: number;
  remaining?: number;
  plan: Plan;
  quota: number;
}

/**
 * Consume one AI-action token for this user. Returns `{ ok: false }` when
 * over quota — caller should return 429 to the client.
 */
export function consumeAiQuota(userId: string, plan: string): QuotaResult {
  const normalisedPlan = (plan as Plan) in QUOTAS ? (plan as Plan) : "FREE";
  const quota = QUOTAS[normalisedPlan];
  const result = rateLimit(`ai:${userId}`, quota, DAY_MS);

  if (!result.ok) {
    return {
      ok: false,
      retryAfterSec: result.retryAfter,
      plan: normalisedPlan,
      quota,
    };
  }
  return { ok: true, plan: normalisedPlan, quota };
}
