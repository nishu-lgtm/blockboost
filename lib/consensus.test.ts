/**
 * Tests for lib/consensus.ts — multi-pass mention aggregation.
 *
 * Rule 9 — every test encodes WHY: a regression in this file means the
 * trust narrative ships fabricated mention rates to customers.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sentiment } from "@prisma/client";
import { aggregateRuns, consensusRunsForPlan, type RunResult } from "./consensus";

function run(brandMentioned: boolean, opts: Partial<RunResult> = {}): RunResult {
  return {
    brandMentioned,
    competitorsMentioned: opts.competitorsMentioned ?? [],
    sentiment: opts.sentiment ?? ("NOT_MENTIONED" as Sentiment),
    responseText: opts.responseText ?? "(stub)",
    mentionRank: opts.mentionRank ?? null,
  };
}

// ── Majority-vote semantics ──────────────────────────────────────────────────

test("N=3: 2/3 agree → brandMentioned true (the headline rule)", () => {
  // INTENT: this is the entire reason multi-pass exists. If 2 of 3 runs
  // agree the brand was mentioned, we trust them. Anything weaker (1/3)
  // is rejected. This rule MUST hold.
  const out = aggregateRuns([run(true), run(true), run(false)]);
  assert.equal(out.brandMentioned, true);
  assert.equal(out.consensusRate, 0.67);
  assert.equal(out.confidence, "high");
});

test("N=3: 1/3 agree → brandMentioned false (suppresses noise)", () => {
  // INTENT: a single flagged run out of three is most likely model noise
  // (or fuzzy brand name match). Suppress to false. Otherwise our visibility
  // rates inflate every time one of three runs hallucinates a mention.
  const out = aggregateRuns([run(true), run(false), run(false)]);
  assert.equal(out.brandMentioned, false);
  assert.equal(out.consensusRate, 0.33);
  // Single-run signal exists but is weak — show as medium confidence
  assert.equal(out.confidence, "medium");
});

test("N=3: 3/3 agree → high confidence, unanimous", () => {
  // INTENT: unanimous agreement is the cleanest signal — never downgrade it.
  const out = aggregateRuns([run(true), run(true), run(true)]);
  assert.equal(out.brandMentioned, true);
  assert.equal(out.consensusRate, 1.0);
  assert.equal(out.confidence, "high");
});

test("N=3: 0/3 agree → false with high confidence (unanimous absence)", () => {
  // INTENT: when all 3 runs agree the brand WAS NOT mentioned, that's a
  // high-confidence absence — used to avoid noise in 'gap prompts' UI.
  const out = aggregateRuns([run(false), run(false), run(false)]);
  assert.equal(out.brandMentioned, false);
  assert.equal(out.consensusRate, 0);
  assert.equal(out.confidence, "high");
});

test("N=1: always low confidence regardless of outcome", () => {
  // INTENT: single-shot runs are the legacy path. We never call them
  // 'high' even when the model says yes — because the model says yes
  // ~60% of the time on borderline prompts, and our customers will notice.
  assert.equal(aggregateRuns([run(true)]).confidence, "low");
  assert.equal(aggregateRuns([run(false)]).confidence, "low");
});

test("N=2: 2/2 agree → medium confidence (better than 1, worse than 3)", () => {
  // INTENT: two-pass is intermediate. Unanimous on 2 runs is still less
  // certain than 2-of-3 on 3 runs because the third sample didn't exist
  // to disagree. Cap at medium.
  assert.equal(aggregateRuns([run(true), run(true)]).confidence, "medium");
  assert.equal(aggregateRuns([run(false), run(false)]).confidence, "medium");
});

test("N=2: 1/2 split → low confidence and brandMentioned false", () => {
  // INTENT: a tied 2-run pair is the lowest-trust signal short of nothing.
  // Default to NOT mentioned (don't inflate) and mark as low confidence.
  const out = aggregateRuns([run(true), run(false)]);
  assert.equal(out.brandMentioned, false); // ceil(2/2)=1 but we tie-break to false
  assert.equal(out.confidence, "low");
});

// ── Competitor union + sentiment + representative text ──────────────────────

test("competitors are unioned across all runs (recall over precision)", () => {
  // INTENT: if any run sees a competitor named, it's a real signal — the
  // competitor existed in the AI's response space. Suppressing it because
  // it only appeared in 1 of 3 would erase real intelligence.
  const out = aggregateRuns([
    run(true, { competitorsMentioned: ["A", "B"] }),
    run(true, { competitorsMentioned: ["B", "C"] }),
    run(false, { competitorsMentioned: ["D"] }),
  ]);
  assert.deepEqual(out.competitorsMentioned.sort(), ["A", "B", "C", "D"]);
});

test("sentiment is mode of flagged runs only — never invented when brand absent", () => {
  // INTENT: sentiment only matters for mentioned-brand runs. If the brand
  // isn't mentioned by majority, the sentiment field MUST be NOT_MENTIONED
  // — never POSITIVE because two of three said something nice about a
  // competitor.
  const out = aggregateRuns([
    run(true, { sentiment: "POSITIVE" as Sentiment }),
    run(true, { sentiment: "POSITIVE" as Sentiment }),
    run(true, { sentiment: "NEGATIVE" as Sentiment }),
  ]);
  assert.equal(out.sentiment, "POSITIVE");

  const allMissing = aggregateRuns([run(false), run(false), run(false)]);
  assert.equal(allMissing.sentiment, "NOT_MENTIONED");
});

test("representative responseText is from first flagged run when available", () => {
  // INTENT: the UI shows ONE responseText to the user. Picking from a
  // flagged run (rather than the last unflagged one) ensures the customer
  // sees the prose that actually mentions their brand — supports the
  // 'why was this flagged' explainability.
  const out = aggregateRuns([
    run(false, { responseText: "no brand here" }),
    run(true, { responseText: "ACME is great" }),
    run(true, { responseText: "ACME is also great" }),
  ]);
  assert.equal(out.responseText, "ACME is great");
});

// ── Plan policy ──────────────────────────────────────────────────────────────

test("consensusRunsForPlan: GROWTH+ gets 3, FREE/STARTER get 1", () => {
  // INTENT: the cost/quality tradeoff. Pinning this in a test means a
  // future bump to STARTER (e.g. to 2 runs) is a visible, deliberate
  // change rather than a silent infra cost increase.
  assert.equal(consensusRunsForPlan("GROWTH"), 3);
  assert.equal(consensusRunsForPlan("AGENCY"), 3);
  assert.equal(consensusRunsForPlan("ENTERPRISE"), 3);
  assert.equal(consensusRunsForPlan("STARTER"), 1);
  assert.equal(consensusRunsForPlan("FREE"), 1);
  // Unknown plan defaults to FREE behaviour (safest cost-wise)
  assert.equal(consensusRunsForPlan("MYSTERY"), 1);
});

test("aggregateRuns throws on empty input (fail loud — Rule 12)", () => {
  // INTENT: callers must guard against empty runs explicitly. Silent
  // return of a fake mention would corrupt the visibility score.
  assert.throws(() => aggregateRuns([]), /zero runs/);
});
