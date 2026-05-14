/**
 * Tests for lib/decay.ts — Sprint 7 visibility decay detector.
 *
 * Rule 9: every test encodes WHY. A regression here means we either
 * (a) miss a real visibility drop our customer is paying us to detect, or
 * (b) cry wolf on noise and erode trust. Both are product-killing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDecay, decayAlertMessage } from "./decay";

// Helper: build a Mention at N days ago with confidence default 'high'
function m(daysAgo: number, brandMentioned: boolean, confidence: "high" | "medium" | "low" | null = "high") {
  const t = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  return { createdAt: new Date(t), brandMentioned, confidence };
}

const FIXED_NOW = new Date("2026-05-15T12:00:00Z");

test("classic 15pp drop on adequate samples → verdict=decay", () => {
  // INTENT: this is the headline use case. Customer was at 50%, dropped
  // to 35%. We must flag it. Sample sizes are well above the 5-row floor.
  const mentions = [
    // Current window (0-7 days ago): 7 of 20 hit = 35%
    ...Array.from({ length: 7 }, () => m(3, true)),
    ...Array.from({ length: 13 }, () => m(3, false)),
    // Previous window (7-14 days ago): 10 of 20 hit = 50%
    ...Array.from({ length: 10 }, () => m(10, true)),
    ...Array.from({ length: 10 }, () => m(10, false)),
  ];
  const r = computeDecay({ mentions, now: FIXED_NOW });
  assert.equal(r.currentRate, 35);
  assert.equal(r.previousRate, 50);
  assert.equal(r.deltaPP, -15);
  assert.equal(r.verdict, "decay");
  assert.equal(r.hasEnoughData, true);
});

test("small 5pp drop → verdict=stable (don't cry wolf)", () => {
  // INTENT: a noisy 5pp dip on a brand-new scan history shouldn't fire an
  // alert. We tuned the threshold at 10pp specifically to suppress this.
  const mentions = [
    ...Array.from({ length: 10 }, () => m(3, true)),  // 10/20 = 50%
    ...Array.from({ length: 10 }, () => m(3, false)),
    ...Array.from({ length: 11 }, () => m(10, true)), // 11/20 = 55%
    ...Array.from({ length: 9 }, () => m(10, false)),
  ];
  const r = computeDecay({ mentions, now: FIXED_NOW });
  assert.equal(r.verdict, "stable");
  assert.ok(Math.abs(r.deltaPP) < 10, `delta ${r.deltaPP} should be small`);
});

test("growth ≥10pp → verdict=growth (separate from decay)", () => {
  // INTENT: same threshold, opposite direction. Used later by the
  // re-baselining UX ('+18pp this week — your optimisation worked').
  const mentions = [
    ...Array.from({ length: 15 }, () => m(3, true)),  // 15/20 = 75%
    ...Array.from({ length: 5 }, () => m(3, false)),
    ...Array.from({ length: 10 }, () => m(10, true)), // 10/20 = 50%
    ...Array.from({ length: 10 }, () => m(10, false)),
  ];
  const r = computeDecay({ mentions, now: FIXED_NOW });
  assert.equal(r.deltaPP, 25);
  assert.equal(r.verdict, "growth");
});

test("too few mentions → verdict=no-data (never alert on shaky basis)", () => {
  // INTENT: with only 4 scans in a window, any rate flip looks dramatic.
  // We MUST refuse to alert. Floor is 5 samples per window (the constant
  // is hardcoded in lib/decay.ts so this test pins the contract).
  const mentions = [
    ...Array.from({ length: 4 }, () => m(3, true)),
    ...Array.from({ length: 4 }, () => m(10, false)),
  ];
  const r = computeDecay({ mentions, now: FIXED_NOW });
  assert.equal(r.verdict, "no-data");
  assert.equal(r.hasEnoughData, false);
});

test("low-confidence mentions are excluded from the decay calc", () => {
  // INTENT: Sprint 2 added confidence labels. We refuse to alert based on
  // single-pass noise — that's the whole reason multi-pass exists. So
  // mentions with confidence='low' are dropped before counting.
  const mentions = [
    // Current window — 100% mentioned but ALL low confidence → ignored
    ...Array.from({ length: 10 }, () => m(3, true, "low")),
    // Previous window — 6 high, all mentioned: 6/6 = 100%
    ...Array.from({ length: 6 }, () => m(10, true, "high")),
  ];
  const r = computeDecay({ mentions, now: FIXED_NOW });
  // Current sample is empty (all low filtered out), prev is 6 → no-data
  assert.equal(r.currentSampleSize, 0);
  assert.equal(r.previousSampleSize, 6);
  assert.equal(r.verdict, "no-data");
});

test("mentions outside both windows are ignored", () => {
  // INTENT: only the last 14 days count. A 30-day-old mention must not
  // accidentally bleed into the previous-window rate.
  const mentions = [
    // Current
    ...Array.from({ length: 5 }, () => m(2, true)),
    ...Array.from({ length: 5 }, () => m(2, false)),
    // Previous
    ...Array.from({ length: 5 }, () => m(10, true)),
    ...Array.from({ length: 5 }, () => m(10, false)),
    // ANCIENT — 30 days old, must not affect either rate
    ...Array.from({ length: 100 }, () => m(30, true)),
  ];
  const r = computeDecay({ mentions, now: FIXED_NOW });
  assert.equal(r.currentSampleSize, 10);
  assert.equal(r.previousSampleSize, 10);
});

test("decayAlertMessage renders the headline that ships to the user", () => {
  // INTENT: this string is what customers will read in the Alert UI + email
  // body. Locking the format means future copy edits are deliberate.
  const r = computeDecay({
    mentions: [
      ...Array.from({ length: 7 }, () => m(3, true)),
      ...Array.from({ length: 13 }, () => m(3, false)),
      ...Array.from({ length: 10 }, () => m(10, true)),
      ...Array.from({ length: 10 }, () => m(10, false)),
    ],
    now: FIXED_NOW,
  });
  const msg = decayAlertMessage(r, "PlutoxAI");
  assert.match(msg, /PlutoxAI visibility dropped 15pp/);
  assert.match(msg, /50% → 35%/);
  assert.match(msg, /20 mentions/);
});
