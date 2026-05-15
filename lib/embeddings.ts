/**
 * Embedding helper — sibling to lib/llm-call.ts.
 *
 * Wraps text-embedding-3-small for semantic similarity checks. Kept separate
 * from llmCall because embeddings have a different API shape (no messages,
 * no JSON schema, no moderation) — merging would complicate both (Rule 2).
 *
 * Usage:
 *   const vec = await embedCall("BlockBoost analytics");
 *   const sim = cosineSimilarity(vec, otherVec);
 */

import OpenAI from "openai";
import { Models } from "@/lib/llm-call";
import { logSafeError } from "@/lib/safe-error";

// Cosine similarity >= this → treat as a semantic brand match when exact
// string match failed. Calibrated for full-response-text vs short brand-name
// comparisons: the brand signal is diluted in a long text, so the threshold
// is lower than you'd use for sentence-to-sentence comparison.
export const BRAND_SIMILARITY_THRESHOLD = 0.30;

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export function isEmbeddingAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// In-memory cache keyed by text — avoids re-embedding the same brand name
// on every scan call. Process-scoped (not persistent), which is fine: the
// brand name is stable within a scan run and the cache amortises it.
const _cache = new Map<string, number[]>();

/**
 * Embed `text` using text-embedding-3-small.
 * Returns an empty array on any error or missing API key — callers must
 * check `.length === 0` before using the vector.
 */
export async function embedCall(text: string): Promise<number[]> {
  if (!text.trim()) return [];

  const cacheKey = text.slice(0, 500); // cap key length
  const cached = _cache.get(cacheKey);
  if (cached) return cached;

  const client = getClient();
  if (!client) return [];

  try {
    const response = await client.embeddings.create({
      model: Models.embedSmall,
      input: text,
      encoding_format: "float",
    });
    const vec = response.data[0]?.embedding ?? [];
    if (vec.length > 0) _cache.set(cacheKey, vec);
    return vec;
  } catch (err) {
    logSafeError("[embeddings] embedCall failed", err);
    return [];
  }
}

/**
 * Cosine similarity between two vectors. Returns 0 for empty or mismatched
 * vectors (never throws). Range: -1 to 1; higher = more similar.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
