/**
 * Query Intent Classifier — rules-first, deterministic.
 *
 * Maps user-written prompts into the QueryIntent taxonomy:
 *   DISCOVERY      — "best X brands", catch-all for informational queries
 *   COMPARISON     — "X vs Y", "X compared to Y"
 *   COMMERCIAL     — price/budget intent ("cheapest", "$", "under $")
 *   PROBLEM        — instructional / troubleshooting ("how to", "why")
 *   RECOMMENDATION — explicit ask for a recommendation
 *
 * Why rules first (Rule 5 — LLM only for judgment):
 *   1. Most prompts cleanly match one pattern. Throwing a GPT call at
 *      every prompt would cost money + add latency for zero gain.
 *   2. Deterministic output → tests can lock in behaviour (Rule 9).
 *   3. Fail-soft: when nothing matches, default to DISCOVERY (the most
 *      common intent), not a confidence-zero classification.
 *
 * Add a GPT fallback later only if production data shows the rules
 * misclassify >5% of prompts in any project.
 */

import type { QueryIntent } from "@prisma/client";

// Order matters: more specific markers first. The first rule that matches
// wins. Each pattern is anchored against the lower-cased prompt.
const RULES: Array<{ intent: QueryIntent; pattern: RegExp }> = [
  // COMPARISON — strong markers, never overloaded with other intents.
  // \bvs\.?\b covers "vs", "vs.", but not "visualisation"
  {
    intent: "COMPARISON",
    pattern: /\bvs\.?\b|\bversus\b|\bcompared\s+to\b|\bcompare\s+\w+/i,
  },

  // PROBLEM — instructional/causal. Anchored at the start to avoid
  // false-flagging "what's the best how-to guide".
  {
    intent: "PROBLEM",
    pattern: /^\s*(?:how\s+(?:to|do|does|can)|why|where|when)\b/i,
  },

  // RECOMMENDATION — explicit ask for what people pick.
  // "what do people recommend", "any suggestions for", "what should I use"
  {
    intent: "RECOMMENDATION",
    pattern: /\brecommend(?:s|ations?|ed)?\b|\bsuggestions?\s+(?:for|on)\b|\bwhat\s+should\s+i\b/i,
  },

  // COMMERCIAL — price/budget markers. Order matters: this is broader
  // than RECOMMENDATION's "what should I", so RECOMMENDATION wins on
  // mixed prompts like "what should I buy under $200".
  // Match: $, "price", "pricing", "cheapest", "affordable", "under $X",
  // "budget", "free X" (free-tier products are commercial intent too).
  {
    intent: "COMMERCIAL",
    pattern:
      /\$\d|\bpric(?:e|ing)\b|\bcheap(?:est|er)?\b|\baffordable\b|\bunder\s+\$?\d|\bbudget\b|\bfree\s+\w+\s+(?:tool|software|crm|app)\b/i,
  },
];

/**
 * Returns the matched intent, or DISCOVERY when no rule fires.
 *
 * DISCOVERY is the catch-all for informational / general-best queries
 * ("best CRM", "top tools 2026", "leading X") — both because that's
 * the most common shape and because misclassifying any other intent
 * AS DISCOVERY is the cheapest mistake (it slots into the broadest
 * bucket on the visibility breakdown UI).
 */
export function classifyIntent(text: string): QueryIntent {
  if (typeof text !== "string" || text.trim().length === 0) {
    return "DISCOVERY";
  }

  for (const { intent, pattern } of RULES) {
    if (pattern.test(text)) return intent;
  }
  return "DISCOVERY";
}

/** Human-readable label for UI / reports. */
export const INTENT_LABELS: Record<QueryIntent, string> = {
  DISCOVERY: "Discovery",
  COMPARISON: "Comparison",
  COMMERCIAL: "Commercial intent",
  PROBLEM: "Problem / How-to",
  RECOMMENDATION: "Recommendation",
};

/**
 * Commercial-weight per intent — used by visibility scoring later to
 * surface "high commercial-intent visibility" as the metric that
 * actually correlates with revenue.
 *
 *   COMMERCIAL     → 1.0  (direct purchase signal)
 *   RECOMMENDATION → 0.85 (high purchase signal)
 *   COMPARISON     → 0.7  (mid-funnel evaluation)
 *   DISCOVERY      → 0.4  (top-of-funnel)
 *   PROBLEM        → 0.2  (support intent, weakest commercial signal)
 */
export const INTENT_COMMERCIAL_WEIGHT: Record<QueryIntent, number> = {
  COMMERCIAL: 1.0,
  RECOMMENDATION: 0.85,
  COMPARISON: 0.7,
  DISCOVERY: 0.4,
  PROBLEM: 0.2,
};
