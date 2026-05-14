/**
 * Multi-pass consensus aggregator for AI scans.
 *
 * Why: a single ChatGPT/Perplexity query is non-deterministic. Asking the
 * same question 3× and only flagging "brand mentioned" when ≥2/3 runs agree
 * eliminates most of the false-positive / false-negative noise.
 *
 * What this module owns:
 *   - aggregateRuns(): given N parsed runs for the same (prompt, platform),
 *     return one consolidated Mention row + a confidence label.
 *
 * What this module does NOT own:
 *   - The actual N parallel Apify calls — lives in lib/scan-engine.ts.
 *   - DB persistence — caller writes the aggregated row.
 *
 * Confidence labels are derived deterministically from consensusRate and
 * runCount (Rule 5 — code answers, not LLM).
 */

import type { Sentiment } from "@prisma/client";

/**
 * One run's parsed output for a single (prompt, platform).
 * Mirrors the shape produced by lib/mention-parser + lib/scan-engine.
 */
export interface RunResult {
  brandMentioned: boolean;
  competitorsMentioned: string[];
  sentiment: Sentiment;
  responseText: string;
  mentionRank: number | null;
}

export interface AggregatedMention {
  brandMentioned: boolean;
  competitorsMentioned: string[];
  sentiment: Sentiment;
  responseText: string;
  mentionRank: number | null;
  runCount: number;
  consensusRate: number;        // 0.0 – 1.0
  confidence: "high" | "medium" | "low";
}

/**
 * Aggregate N runs of the same (prompt, platform) into a single mention.
 *
 * Decision rule:
 *   - brandMentioned: majority vote (≥ ceil(N/2) runs flagged true).
 *     For N=3 that's 2/3; for N=2 it's 2/2; for N=1 it's 1/1.
 *   - competitorsMentioned: any competitor seen in ANY run is kept
 *     (recall over precision — competitors mentioned once are real signal).
 *   - sentiment: most-common sentiment across runs that flagged the brand.
 *     Falls back to NOT_MENTIONED if brand wasn't mentioned in any run.
 *   - responseText / mentionRank: from the FIRST run where brandMentioned
 *     was true (most representative); else the first run (so UI has
 *     something to show).
 *
 * Confidence label:
 *   - high   = N >= 3 AND ≥2/3 runs agree on brandMentioned
 *   - medium = N == 2 AND 2/2 agree, OR N >= 3 AND only 1/3 flagged
 *   - low    = N == 1 (single-shot), OR N == 2 AND only 1/2 agreed
 *
 * Edge cases:
 *   - runs.length === 0 → throws. Caller must guard.
 */
export function aggregateRuns(runs: RunResult[]): AggregatedMention {
  if (runs.length === 0) {
    throw new Error("aggregateRuns called with zero runs");
  }

  const N = runs.length;
  const flaggedRuns = runs.filter((r) => r.brandMentioned);
  const flaggedCount = flaggedRuns.length;
  const consensusRate = flaggedCount / N;

  // STRICT majority: flaggedCount * 2 > N. This is intentionally stricter
  // than `>= ceil(N/2)` because a 1-of-2 tie would otherwise inflate
  // visibility. For N=1 a single yes still wins (1*2 > 1). For N=2 only
  // 2-of-2 wins. For N=3 only 2-of-3 or 3-of-3 win.
  const brandMentioned = flaggedCount * 2 > N;

  // Confidence — derived from N + agreement strength
  let confidence: "high" | "medium" | "low";
  if (N === 1) {
    confidence = "low";
  } else if (N === 2) {
    // Unanimous on 2 runs → medium (better than single, worse than 3).
    // Split 1/1 → low (we can't trust a tie).
    confidence = flaggedCount === 0 || flaggedCount === 2 ? "medium" : "low";
  } else {
    // N >= 3
    if (flaggedCount === 0 || flaggedCount === N) {
      confidence = "high"; // unanimous either direction
    } else if (flaggedCount * 2 > N) {
      confidence = "high"; // strict majority for true
    } else {
      confidence = "medium"; // minority signal — present but weak
    }
  }

  // Competitors — union across all runs (recall over precision)
  const competitorSet = new Set<string>();
  for (const r of runs) {
    for (const c of r.competitorsMentioned) competitorSet.add(c);
  }
  const competitorsMentioned = [...competitorSet];

  // Sentiment — most-common among flagged runs; NOT_MENTIONED fallback
  let sentiment: Sentiment;
  if (brandMentioned && flaggedRuns.length > 0) {
    const counts = new Map<Sentiment, number>();
    for (const r of flaggedRuns) {
      counts.set(r.sentiment, (counts.get(r.sentiment) ?? 0) + 1);
    }
    sentiment = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  } else {
    sentiment = "NOT_MENTIONED" as Sentiment;
  }

  // Representative response text + rank
  const representative = flaggedRuns[0] ?? runs[0];
  const responseText = representative.responseText;
  const mentionRank = representative.mentionRank;

  return {
    brandMentioned,
    competitorsMentioned,
    sentiment,
    responseText,
    mentionRank,
    runCount: N,
    consensusRate: Math.round(consensusRate * 100) / 100, // 2dp
    confidence,
  };
}

/**
 * How many runs to execute per (prompt, platform) for a given plan.
 * Caller (scan-engine) reads this; we keep the policy here so it's
 * one place to change later.
 *
 * Cost note: Apify charges per run. N=3 triples cost vs N=1.
 * FREE/STARTER stay at N=1 to keep costs sustainable; Growth+ gets
 * the trust-grade scan.
 */
export function consensusRunsForPlan(plan: string): number {
  switch (plan) {
    case "GROWTH":
    case "AGENCY":
    case "ENTERPRISE":
      return 3;
    case "STARTER":
      return 1; // bumped to 2 once we validate Apify cost
    case "FREE":
    default:
      return 1;
  }
}
