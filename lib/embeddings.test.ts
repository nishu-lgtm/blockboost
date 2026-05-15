/**
 * Tests for lib/embeddings.ts — Sprint 3.
 *
 * Rule 9: tests encode WHY. cosineSimilarity is the core math behind
 * brand detection; a regression here silently breaks mention recall for
 * every customer scan.
 *
 * All tests use hand-rolled vectors — no live OpenAI calls so the suite
 * stays fast and offline-safe.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cosineSimilarity, isEmbeddingAvailable } from "./embeddings";

// ── cosineSimilarity — pure math, no I/O ────────────────────────────────────

test("cosineSimilarity: identical vectors → 1.0 (perfect match)", () => {
  // INTENT: a brand name compared to itself must always score 1.0.
  // If this fails, the threshold logic is meaningless.
  const v = [0.6, 0.8, 0.0];
  assert.equal(cosineSimilarity(v, v), 1.0);
});

test("cosineSimilarity: orthogonal vectors → 0.0 (no relationship)", () => {
  // INTENT: completely unrelated concepts should score 0. If orthogonal
  // vectors score > 0, the threshold would need to be raised and we'd
  // lose the brand-not-mentioned signal.
  assert.equal(cosineSimilarity([1, 0, 0], [0, 1, 0]), 0);
});

test("cosineSimilarity: opposite vectors → -1.0 (antonyms)", () => {
  // INTENT: confirms the full -1 to 1 range is preserved — needed to
  // reason correctly about the threshold boundary.
  assert.equal(cosineSimilarity([1, 0, 0], [-1, 0, 0]), -1);
});

test("cosineSimilarity: scaled vectors → same score as unit vectors", () => {
  // INTENT: cosine is scale-invariant. Embedding magnitude should never
  // affect detection. If scaling changes the score, embeddings with
  // different norms (e.g. short vs long texts) produce inconsistent results.
  const a = [3, 4, 0];
  const b = [6, 8, 0]; // same direction, 2× scale
  const sim = cosineSimilarity(a, b);
  assert.ok(Math.abs(sim - 1.0) < 1e-10, `expected ~1.0, got ${sim}`);
});

test("cosineSimilarity: empty vectors → 0 (no crash, no NaN)", () => {
  // INTENT: embedCall returns [] on error. The caller must never receive
  // NaN or throw — that would propagate to the scan engine and break
  // an entire customer's scan run.
  assert.equal(cosineSimilarity([], []), 0);
  assert.equal(cosineSimilarity([1, 2], []), 0);
  assert.equal(cosineSimilarity([], [1, 2]), 0);
});

test("cosineSimilarity: mismatched lengths → 0 (defensive)", () => {
  // INTENT: if the API ever returns a differently-sized embedding (model
  // change, truncation), we must not crash or produce garbage similarity.
  assert.equal(cosineSimilarity([1, 0], [1, 0, 0]), 0);
});

test("cosineSimilarity: zero vector → 0 (no NaN from divide-by-zero)", () => {
  // INTENT: a zero-magnitude vector (all zeros) would produce NaN via 0/0.
  // NaN propagates silently and would make every similarity check unreliable.
  const zero = [0, 0, 0];
  const v = [1, 0, 0];
  assert.equal(cosineSimilarity(zero, v), 0);
  assert.equal(cosineSimilarity(v, zero), 0);
});

// ── isEmbeddingAvailable ─────────────────────────────────────────────────────

test("isEmbeddingAvailable: returns false when OPENAI_API_KEY is unset", () => {
  // INTENT: mirrors the llm-call behaviour test. When no key is present
  // the mention-parser must fall back to exact-match only — never throw
  // or silently drop the scan.
  const saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  assert.equal(isEmbeddingAvailable(), false);
  if (saved) process.env.OPENAI_API_KEY = saved;
});
