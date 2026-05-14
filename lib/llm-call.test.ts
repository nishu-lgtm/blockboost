/**
 * Tests for lib/llm-call.ts — focus on INTENT (Rule 9), not implementation.
 *
 * Run: `npm test` (uses tsx --test, no extra deps).
 *
 * Scope is deliberately narrow: the "OpenAI unavailable" code path. That's
 * the path that runs in production today (quota exhausted = same as no key
 * for our purposes) and the path most likely to break silently if we touch
 * the wrapper. Moderation-block / schema-fail paths need a mock OpenAI
 * client — out of scope until that mocking infra exists.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { llmCall, isLlmAvailable } from "./llm-call";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

before(() => {
  // llmCall reads OPENAI_API_KEY at call time (not import time), so we
  // can flip the env per-test safely.
  delete process.env.OPENAI_API_KEY;
});

after(() => {
  if (ORIGINAL_KEY !== undefined) process.env.OPENAI_API_KEY = ORIGINAL_KEY;
});

test("isLlmAvailable returns false when OPENAI_API_KEY is unset", () => {
  // INTENT: callers use this to short-circuit BEFORE running expensive prep.
  // Lying here would defeat the whole "graceful degradation" contract.
  assert.equal(isLlmAvailable(), false);
});

test("llmCall returns the caller's fallback verbatim when no API key", async () => {
  // INTENT: downstream code receives the EXACT shape it asked for, even on
  // failure — so type assertions, .map(), .filter() etc don't blow up.
  const fallback = { sentiment: "NEUTRAL" as const, confidence: 0.5, tags: ["x", "y"] };
  const result = await llmCall({
    feature: "test:fallback-shape",
    model: "fast",
    schema: z.object({
      sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
      confidence: z.number(),
      tags: z.array(z.string()),
    }),
    fallback,
    messages: [{ role: "user", content: "hello" }],
  });

  assert.deepEqual(result.data, fallback);
});

test("llmCall flags `no-api-key` reason and never lies about freshness", async () => {
  // INTENT: UI surfaces "AI temporarily unavailable" badges based on these
  // flags. If we said `isFresh: true` on a fallback, the dashboard would
  // show fabricated data as if it were real. Silent failure = product
  // trust failure (Rule 12).
  const result = await llmCall({
    feature: "test:flags",
    model: "fast",
    schema: z.object({ ok: z.boolean() }),
    fallback: { ok: false },
    messages: [{ role: "user", content: "hi" }],
  });

  assert.equal(result.isFresh, false);
  assert.equal(result.cached, false);
  assert.equal(result.fallbackReason, "no-api-key");
});

test("llmCall does NOT throw when OpenAI is unavailable", async () => {
  // INTENT: throws would bubble to 500 responses. Every AI feature MUST
  // degrade gracefully because OpenAI quota exhaustion / outage is real
  // and shouldn't break the rest of the product.
  await assert.doesNotReject(async () => {
    await llmCall({
      feature: "test:no-throw",
      model: "fast",
      schema: z.object({ x: z.string() }),
      fallback: { x: "fallback" },
      messages: [{ role: "user", content: "user content here" }],
    });
  });
});
