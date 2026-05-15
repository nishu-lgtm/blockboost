/**
 * Tests for lib/chunker.ts — Sprint 4.
 * Rule 9: tests encode WHY. Chunking is the foundation of retrieval sim;
 * a broken chunker silently corrupts every embedding stored downstream.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText, htmlToChunks } from "./chunker";

test("chunkText: empty string → empty array (no crash, no empty chunks)", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   "), []);
});

test("chunkText: text shorter than target → single chunk, index 0", () => {
  const chunks = chunkText("hello world foo bar");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].index, 0);
  assert.ok(chunks[0].text.includes("hello"));
});

test("chunkText: long text → multiple chunks with sequential indices", () => {
  // INTENT: index must increment so callers can reconstruct document order.
  const words = Array.from({ length: 900 }, (_, i) => `word${i}`).join(" ");
  const chunks = chunkText(words);
  assert.ok(chunks.length >= 2);
  chunks.forEach((c, i) => assert.equal(c.index, i));
});

test("chunkText: no chunk exceeds target + overlap size", () => {
  // INTENT: embedding models have token limits; oversized chunks cause API errors.
  const words = Array.from({ length: 2000 }, (_, i) => `w${i}`).join(" ");
  const chunks = chunkText(words);
  for (const c of chunks) {
    const wc = c.text.split(" ").length;
    assert.ok(wc <= 450, `chunk ${c.index} has ${wc} words, expected ≤ 450`);
  }
});

test("chunkText: consecutive chunks overlap (context continuity)", () => {
  // INTENT: overlap ensures entities mentioned across a chunk boundary
  // appear in at least one complete chunk, so they aren't missed by embedding.
  const words = Array.from({ length: 900 }, (_, i) => `word${i}`).join(" ");
  const chunks = chunkText(words);
  if (chunks.length >= 2) {
    const lastWordsOfFirst = chunks[0].text.split(" ").slice(-10);
    const firstWordsOfSecond = chunks[1].text.split(" ").slice(0, 60);
    const overlap = lastWordsOfFirst.some((w) => firstWordsOfSecond.includes(w));
    assert.ok(overlap, "consecutive chunks should share words via overlap");
  }
});

test("htmlToChunks: strips script tags so JS doesn't pollute embeddings", () => {
  const html = "<html><script>alert('xss')</script><p>Real content here.</p></html>";
  const chunks = htmlToChunks(html);
  const combined = chunks.map((c) => c.text).join(" ");
  assert.ok(!combined.includes("alert"), "script content must be stripped");
  assert.ok(combined.includes("Real content"), "body content must be preserved");
});

test("htmlToChunks: strips style tags", () => {
  const html = "<style>body{color:red}</style><p>Article text</p>";
  const chunks = htmlToChunks(html);
  const combined = chunks.map((c) => c.text).join(" ");
  assert.ok(!combined.includes("color"), "style content must be stripped");
});

test("htmlToChunks: strips tags and preserves inner text", () => {
  // INTENT: the embedding must be of content, not markup.
  const html = "<h1>Title</h1><p>Paragraph <strong>text</strong> here.</p>";
  const chunks = htmlToChunks(html);
  const combined = chunks.map((c) => c.text).join(" ");
  assert.ok(combined.includes("Title"), "h1 text must be preserved");
  assert.ok(combined.includes("Paragraph"), "p text must be preserved");
  assert.ok(!combined.includes("<p>"), "HTML tags must not appear in output");
});
