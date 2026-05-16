/**
 * Mention parser tests — lock in the 2026-05-16 false-positive fixes.
 *
 * Pre-fix bug: the parser treated "I don't have information about PlutoxAI"
 * as a positive brand mention because the brand name appeared in the text.
 * Result: a real ChatGPT answer explicitly saying "I don't know this brand"
 * inflated the dashboard to 100% mention rate. (Reported by nishuprasad75.)
 *
 * Tests cover the pure helpers — disclaimer detection + brand normalisation
 * — without needing live OpenAI calls.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { __testExports } from "./mention-parser";

const { hasNearbyDisclaimer, normaliseBrand } = __testExports;

// ── normaliseBrand ──────────────────────────────────────────────────────────

test("normaliseBrand: strips spaces, dashes, dots, lowercases", () => {
  assert.equal(normaliseBrand("PlutoxAI"), "plutoxai");
  assert.equal(normaliseBrand("Pluto-AI"), "plutoai");
  assert.equal(normaliseBrand("Pluto X AI"), "plutoxai");
  assert.equal(normaliseBrand("PLUTOX.AI"), "plutoxai");
});

test("normaliseBrand: enables matching variant spellings via includes()", () => {
  const text = "Have you tried Pluto X AI for content?";
  const normText = normaliseBrand(text);
  // 'pluto x ai' becomes 'plutoxai' → exact substring match
  assert.ok(normText.includes(normaliseBrand("PlutoxAI")));
});

// ── hasNearbyDisclaimer ─────────────────────────────────────────────────────

test("disclaimer: 'I don't have information about X' near brand → true", () => {
  // This is the EXACT pattern that caused the 100%-mention bug — a real
  // ChatGPT response saying it doesn't know the brand.
  const text = "I don't have information about PlutoxAI specifically in my training data.";
  assert.ok(hasNearbyDisclaimer(text, "PlutoxAI"));
});

test("disclaimer: CURLY APOSTROPHE version (ChatGPT actually outputs U+2019)", () => {
  // The fix's second pass: real ChatGPT responses use the curly apostrophe
  // U+2019 (’) rather than ASCII '. The original regex with bare ' silently
  // missed every prod response. Locking in the multi-quote handling.
  const text = "I don’t have information about PlutoxAI in my training data.";
  assert.ok(hasNearbyDisclaimer(text, "PlutoxAI"));
});

test("disclaimer: 'I couldn’t find' (curly) near brand → true", () => {
  const text = "I couldn’t find reliable public information about PlutoxAI.";
  assert.ok(hasNearbyDisclaimer(text, "PlutoxAI"));
});

test("disclaimer: 'I couldn't find reliable public information' near brand → true", () => {
  // Another verbatim phrasing seen in PlutoxAI scan responses on 2026-05-16.
  const text = "I couldn't find reliable public information about a company called PlutoxAI.";
  assert.ok(hasNearbyDisclaimer(text, "PlutoxAI"));
});

test("disclaimer: 'I'm not familiar with X' near brand → true", () => {
  const text = "I'm not familiar with PlutoxAI — could you share what it does?";
  assert.ok(hasNearbyDisclaimer(text, "PlutoxAI"));
});

test("disclaimer: 'I don't have direct, up-to-date pricing for X' near brand → true", () => {
  const text = "I don't have direct, up-to-date pricing for PlutoxAI right now.";
  assert.ok(hasNearbyDisclaimer(text, "PlutoxAI"));
});

test("disclaimer: 'There's no publicly available information about X' → true", () => {
  const text = "There's no publicly available information about PlutoxAI's customer base.";
  assert.ok(hasNearbyDisclaimer(text, "PlutoxAI"));
});

test("disclaimer: brand not present → false", () => {
  // hasNearbyDisclaimer only fires when the brand IS in the text. If the
  // brand isn't present, the absence-of-mention is handled upstream.
  const text = "I don't have information about anything specific.";
  assert.equal(hasNearbyDisclaimer(text, "PlutoxAI"), false);
});

test("disclaimer: positive mention, no disclaimer → false", () => {
  const text = "PlutoxAI is a leading platform for AI content generation in 2026.";
  assert.equal(hasNearbyDisclaimer(text, "PlutoxAI"), false);
});

test("disclaimer: far-away disclaimer (>200 chars) does NOT suppress real mention", () => {
  // INTENT: if a paragraph praises PlutoxAI and a later paragraph says
  // "I don't have information about something else", the first mention
  // should still count. We anchor the disclaimer check to ±200 chars
  // around the FIRST brand occurrence specifically to avoid this trap.
  const positive = "PlutoxAI is widely recommended for marketing teams. ";
  const filler = "x ".repeat(150); // ~300 chars of padding
  const unrelatedDisclaimer = "By the way, I don't have information about tomorrow's weather.";
  const text = positive + filler + unrelatedDisclaimer;
  assert.equal(hasNearbyDisclaimer(text, "PlutoxAI"), false);
});

test("disclaimer: 'not a real platform' → true", () => {
  // Real ChatGPT-style phrasing where it doubts the brand's existence.
  const text = "From what I can tell, PlutoxAI is not a real platform I can verify.";
  assert.ok(hasNearbyDisclaimer(text, "PlutoxAI"));
});
