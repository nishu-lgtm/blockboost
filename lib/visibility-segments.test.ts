/**
 * Tests for isPromptBranded — the pure half of visibility-segments.
 * computeVisibilitySegments needs a live DB so it's covered by the
 * PlutoxAI re-analysis verification in the commit message, not unit tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPromptBranded } from "./visibility-segments";

test("branded: prompt with brand name (exact case) → true", () => {
  assert.ok(isPromptBranded("what is PlutoxAI pricing", "PlutoxAI"));
});

test("branded: case-insensitive → true", () => {
  assert.ok(isPromptBranded("plutoxai vs jasper", "PlutoxAI"));
});

test("branded: normalised match (dashes/spaces stripped) → true", () => {
  // 'Pluto-AI' in prompt vs 'PlutoAI' brand → match after stripping dashes
  assert.ok(isPromptBranded("how does Pluto-AI work", "PlutoAI"));
  // 'Pluto X AI' vs 'PlutoXAI' brand → match
  assert.ok(isPromptBranded("Pluto X AI is great", "PlutoXAI"));
});

test("unbranded: generic discovery query without brand → false", () => {
  assert.equal(isPromptBranded("best AI tools 2026", "PlutoxAI"), false);
});

test("unbranded: competitor named but not brand → false", () => {
  assert.equal(isPromptBranded("Jasper vs Copy.ai", "PlutoxAI"), false);
});

test("unbranded: comparison query about category → false", () => {
  assert.equal(isPromptBranded("what do people recommend for AI content generation", "PlutoxAI"), false);
});
