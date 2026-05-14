/**
 * Tests for lib/query-intent.ts — anchor the rules-based classifier.
 *
 * Rule 9 (tests verify intent, not behaviour):
 *   - The 20 sample prompts below are the EXACT real-world shapes the
 *     classifier MUST handle for Sprint 1 to be considered done.
 *   - If a rule edit breaks any of these, the change is wrong — back it out
 *     or fix the regex. The samples are not exhaustive but they're the
 *     contract.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { QueryIntent } from "@prisma/client";
import { classifyIntent, INTENT_COMMERCIAL_WEIGHT, INTENT_LABELS } from "./query-intent";

// ── 20 sample prompts × expected intent ──────────────────────────────────────
// Why these 20: this is the spec from HANDOFF.md Sprint 1 success criteria.
// Adding/removing samples here changes the product contract.
const SAMPLES: Array<{ prompt: string; expected: QueryIntent }> = [
  // DISCOVERY — top-of-funnel, no commercial / comparison / problem markers
  { prompt: "best CRM software for startups", expected: "DISCOVERY" },
  { prompt: "top project management tools", expected: "DISCOVERY" },
  { prompt: "leading SEO tools 2026", expected: "DISCOVERY" },
  { prompt: "best AI assistants", expected: "DISCOVERY" },
  { prompt: "top 10 plumbers in Mumbai", expected: "DISCOVERY" },

  // COMPARISON — explicit "X vs Y" or "compare"
  { prompt: "HubSpot vs Salesforce", expected: "COMPARISON" },
  { prompt: "Notion compared to ClickUp", expected: "COMPARISON" },
  { prompt: "compare Asana and Trello", expected: "COMPARISON" },
  { prompt: "ChatGPT vs. Claude for coding", expected: "COMPARISON" },

  // COMMERCIAL — price / budget signal
  { prompt: "best CRM under $50 per user", expected: "COMMERCIAL" },
  { prompt: "cheapest project management tool", expected: "COMMERCIAL" },
  { prompt: "Notion pricing", expected: "COMMERCIAL" },
  { prompt: "affordable accounting software for small business", expected: "COMMERCIAL" },

  // PROBLEM — instructional / troubleshooting / causal start
  { prompt: "how to integrate Stripe with Shopify", expected: "PROBLEM" },
  { prompt: "why is my page slow", expected: "PROBLEM" },
  { prompt: "how do I export Notion to PDF", expected: "PROBLEM" },
  { prompt: "how does AEO work", expected: "PROBLEM" },

  // RECOMMENDATION — explicit ask for what others pick
  { prompt: "what do people recommend for video editing", expected: "RECOMMENDATION" },
  { prompt: "any suggestions for a remote team collaboration tool", expected: "RECOMMENDATION" },
  { prompt: "what should I use to track AI visibility", expected: "RECOMMENDATION" },
];

test("classifyIntent matches the Sprint 1 spec on all 20 sample prompts", () => {
  // INTENT: each sample is the contract. Recall on this set must stay 100%.
  // Single-test loop so a regression shows the FULL list of mismatches, not
  // just the first failure (Rule 12 — fail loud with complete information).
  const failures: string[] = [];
  for (const { prompt, expected } of SAMPLES) {
    const actual = classifyIntent(prompt);
    if (actual !== expected) {
      failures.push(`  expected ${expected.padEnd(15)} got ${actual.padEnd(15)} — "${prompt}"`);
    }
  }
  assert.equal(
    failures.length,
    0,
    `\n${failures.length}/${SAMPLES.length} sample(s) misclassified:\n${failures.join("\n")}`
  );
});

test("classifyIntent returns DISCOVERY for empty / whitespace input", () => {
  // INTENT: defensive default. Empty input shouldn't throw or return
  // undefined; downstream code groups by intent and expects every Prompt
  // row to have one. DISCOVERY is the safest catch-all (broadest bucket).
  assert.equal(classifyIntent(""), "DISCOVERY");
  assert.equal(classifyIntent("   "), "DISCOVERY");
});

test("INTENT_LABELS covers every QueryIntent — no silently-missing UI strings", () => {
  // INTENT: future addition of a new QueryIntent enum value would silently
  // render undefined in the UI without this guard. The test fails loudly
  // when somebody adds to the enum and forgets the label.
  const allIntents: QueryIntent[] = [
    "DISCOVERY", "COMPARISON", "COMMERCIAL", "PROBLEM", "RECOMMENDATION",
  ];
  for (const i of allIntents) {
    assert.ok(INTENT_LABELS[i], `missing label for ${i}`);
    assert.notEqual(INTENT_LABELS[i], "", `empty label for ${i}`);
  }
});

test("INTENT_COMMERCIAL_WEIGHT preserves the COMMERCIAL > RECOMMENDATION > COMPARISON > DISCOVERY > PROBLEM order", () => {
  // INTENT: the weights drive the "high-commercial-intent visibility" KPI
  // which sales decks lean on. If anyone reorders these, the metric flips
  // meaning. Lock the order with an explicit chain assertion.
  const w = INTENT_COMMERCIAL_WEIGHT;
  assert.ok(w.COMMERCIAL > w.RECOMMENDATION, "COMMERCIAL must outrank RECOMMENDATION");
  assert.ok(w.RECOMMENDATION > w.COMPARISON, "RECOMMENDATION must outrank COMPARISON");
  assert.ok(w.COMPARISON > w.DISCOVERY, "COMPARISON must outrank DISCOVERY");
  assert.ok(w.DISCOVERY > w.PROBLEM, "DISCOVERY must outrank PROBLEM");
  assert.equal(w.COMMERCIAL, 1.0, "COMMERCIAL anchors the top of the scale");
});
