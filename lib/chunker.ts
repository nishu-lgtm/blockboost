/**
 * HTML → text chunks for embedding (Sprint 4).
 *
 * Strips HTML, splits into ~400-word segments with 50-word overlap.
 * Overlap ensures entities spanning chunk boundaries are captured.
 * Rule 5: pure text splitting — no LLM involved here.
 */

const TARGET_WORDS = 400;
const OVERLAP_WORDS = 50;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface TextChunk {
  text: string;
  index: number;
}

export function chunkText(text: string): TextChunk[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < words.length) {
    const end = Math.min(start + TARGET_WORDS, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.trim()) chunks.push({ text: chunk, index: index++ });
    if (end >= words.length) break;
    start = end - OVERLAP_WORDS;
  }

  return chunks;
}

export function htmlToChunks(html: string): TextChunk[] {
  return chunkText(stripHtml(html));
}
