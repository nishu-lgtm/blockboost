/**
 * Tests for lib/bot-detector.ts — Sprint 8 UA classifier.
 *
 * Rule 9: every test encodes WHY. A regression here either lets human
 * traffic into AiBotVisit (pollutes analytics) or misses real GPTBot
 * crawls (worse — the product silently undercounts the thing customers
 * pay us to measure).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyUserAgent, buildDedupeKey, hashIp, type BotLabel } from "./bot-detector";

// ── Known bots — recall must stay 100% ──────────────────────────────────────

const KNOWN_BOT_FIXTURES: Array<{ ua: string; expected: BotLabel }> = [
  // Real UAs published by OpenAI / Anthropic / Perplexity / etc.
  { ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot", expected: "GPTBot" },
  { ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot", expected: "OAI-SearchBot" },
  { ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot", expected: "ChatGPT-User" },
  { ua: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", expected: "ClaudeBot" },
  { ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot", expected: "PerplexityBot" },
  { ua: "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com) AppleWebKit/537.36", expected: "Bytespider" },
  { ua: "CCBot/2.0 (https://commoncrawl.org/faq/)", expected: "CCBot" },
  { ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Safari/537.36 (compatible; Google-Extended; ...)", expected: "Google-Extended" },
];

test("classifyUserAgent: every known AI bot is recognised by its canonical UA", () => {
  // INTENT: if any of these break, we silently undercount the thing
  // customers pay us to measure. Single-test loop so the failure message
  // shows ALL misses at once (Rule 12 fail loud).
  const fails: string[] = [];
  for (const { ua, expected } of KNOWN_BOT_FIXTURES) {
    const actual = classifyUserAgent(ua);
    if (actual !== expected) {
      fails.push(`  ${ua.slice(0, 60)}… → expected ${expected}, got ${actual}`);
    }
  }
  assert.equal(fails.length, 0, `\n${fails.length}/${KNOWN_BOT_FIXTURES.length} UAs misclassified:\n${fails.join("\n")}`);
});

test("classifyUserAgent: AI-ish unknown agent → 'OTHER' (still ingested)", () => {
  // INTENT: emerging crawlers from known AI vendors. We don't have a
  // label yet but we want the row so we can detect the trend. Tagging
  // OTHER lets analytics surface "unrecognised AI traffic increasing".
  assert.equal(classifyUserAgent("Mozilla/5.0 (compatible; openai-experimental/1.0)"), "OTHER");
  assert.equal(classifyUserAgent("anthropic-mystery-crawler/2.0"), "OTHER");
});

test("classifyUserAgent: human browsers → null (dropped at ingest)", () => {
  // INTENT: a user reloading their dashboard sends visits to track.js too —
  // those MUST be filtered out before they hit AiBotVisit. Otherwise the
  // dashboard shows millions of "human" rows and the bot signal is lost
  // in the noise.
  const humans = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/123.0",
  ];
  for (const ua of humans) {
    assert.equal(classifyUserAgent(ua), null, `should drop: ${ua.slice(0, 50)}…`);
  }
});

test("classifyUserAgent: empty / null / non-string input → null", () => {
  // INTENT: defensive. Garbage in = drop. Never let undefined propagate to
  // a botName="undefined" row.
  assert.equal(classifyUserAgent(""), null);
  assert.equal(classifyUserAgent(null), null);
  assert.equal(classifyUserAgent(undefined), null);
});

// ── Dedupe key ──────────────────────────────────────────────────────────────

test("buildDedupeKey: same (project, bot, url, day) → identical key", () => {
  // INTENT: this is the entire dedupe contract. If keys aren't identical,
  // the unique constraint can't filter duplicates and bot reloads inflate
  // the counter.
  const day = new Date("2026-05-15T03:00:00Z");
  const a = buildDedupeKey({ projectId: "p1", botName: "GPTBot", url: "/blog/x", at: day });
  const b = buildDedupeKey({ projectId: "p1", botName: "GPTBot", url: "/blog/x", at: new Date("2026-05-15T23:59:00Z") });
  assert.equal(a, b);
});

test("buildDedupeKey: different day → different key (cross-day re-count is correct)", () => {
  // INTENT: dedupe is PER DAY not forever. A bot that hits the same URL
  // on consecutive days is legitimate signal — count both.
  const a = buildDedupeKey({ projectId: "p1", botName: "GPTBot", url: "/x", at: new Date("2026-05-15") });
  const b = buildDedupeKey({ projectId: "p1", botName: "GPTBot", url: "/x", at: new Date("2026-05-16") });
  assert.notEqual(a, b);
});

test("buildDedupeKey: different bot → different key", () => {
  // INTENT: if GPTBot and PerplexityBot hit the same URL same day, we
  // need BOTH rows so the bot-breakdown dashboard works.
  const a = buildDedupeKey({ projectId: "p1", botName: "GPTBot", url: "/x" });
  const b = buildDedupeKey({ projectId: "p1", botName: "PerplexityBot", url: "/x" });
  assert.notEqual(a, b);
});

// ── IP hashing ──────────────────────────────────────────────────────────────

test("hashIp: identical (ip, salt) → identical hash", () => {
  // INTENT: needed for "unique visitors per bot" analytics. Same IP +
  // same project salt = same hash. (Different salt → different hash,
  // tested below to prevent cross-project tracking.)
  assert.equal(hashIp("1.2.3.4", "salt-a"), hashIp("1.2.3.4", "salt-a"));
});

test("hashIp: different salt → different hash (no cross-project linking)", () => {
  // INTENT: privacy. The same crawler IP hits 100 different customer
  // projects; we MUST NOT produce identical hashes for it across projects
  // (would allow us to derive that "the same bot visits all these sites").
  // Salt per project (or session secret) breaks the correlation.
  const a = hashIp("1.2.3.4", "salt-a");
  const b = hashIp("1.2.3.4", "salt-b");
  assert.notEqual(a, b);
});

test("hashIp: empty IP → null", () => {
  // INTENT: not all visits include an IP (some proxies strip it).
  // null is the documented "no IP available" signal — never an empty
  // string or garbage hash.
  assert.equal(hashIp(null, "salt"), null);
  assert.equal(hashIp("", "salt"), null);
  assert.equal(hashIp(undefined, "salt"), null);
});
