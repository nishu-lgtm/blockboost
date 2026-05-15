/**
 * Retrieval Simulation Engine — Sprint 4.
 *
 * Given a URL: fetch HTML → chunk → embed each chunk → store in DB.
 * Given a query: embed query → cosine-rank stored chunks → return top-K.
 *
 * This lets customers see which sections of their site an AI would likely
 * retrieve when answering their tracked queries.
 */

import { prisma } from "@/lib/prisma";
import { embedCall, cosineSimilarity } from "@/lib/embeddings";
import { htmlToChunks } from "@/lib/chunker";
import { safeFetch } from "@/lib/ssrf-guard";
import { logSafeError } from "@/lib/safe-error";

export interface ChunkScore {
  chunkId: string;
  text: string;
  chunkIndex: number;
  score: number; // cosine similarity 0-1
}

export interface RetrievalResult {
  query: string;
  topChunks: ChunkScore[];
  retrievabilityScore: number; // 0-100, max score × 100
}

/**
 * Fetch a URL, chunk its content, embed each chunk, and upsert into DB.
 * Idempotent: deletes existing chunks for this (projectId, url) before insert.
 */
export async function analyzeUrl(
  projectId: string,
  url: string
): Promise<{ chunksStored: number }> {
  // Fetch HTML with SSRF protection
  let html: string;
  try {
    const res = await safeFetch(url, {
      headers: { "User-Agent": "BlockBoostBot/1.0 (retrieval-analysis)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    logSafeError(`[retrieval-engine] fetch failed for ${url}`, err);
    return { chunksStored: 0 };
  }

  const chunks = htmlToChunks(html);
  if (chunks.length === 0) return { chunksStored: 0 };

  // Embed all chunks (sequential to respect rate limits)
  const embedded: Array<{ text: string; index: number; embedding: number[] }> = [];
  for (const chunk of chunks) {
    const vec = await embedCall(chunk.text);
    if (vec.length > 0) embedded.push({ ...chunk, embedding: vec });
  }

  if (embedded.length === 0) return { chunksStored: 0 };

  // Replace existing chunks for this URL
  await prisma.retrievalChunk.deleteMany({ where: { projectId, url } });
  await prisma.retrievalChunk.createMany({
    data: embedded.map((c) => ({
      projectId,
      url,
      text: c.text,
      chunkIndex: c.index,
      embedding: c.embedding,
    })),
  });

  return { chunksStored: embedded.length };
}

/**
 * For a given query string, find the most retrievable chunks stored for a project.
 * Returns top-K chunks ranked by cosine similarity to the query embedding.
 */
export async function findRelevantChunks(
  projectId: string,
  queryText: string,
  topK = 5
): Promise<RetrievalResult> {
  const queryVec = await embedCall(queryText);
  if (queryVec.length === 0) {
    return { query: queryText, topChunks: [], retrievabilityScore: 0 };
  }

  const chunks = await prisma.retrievalChunk.findMany({
    where: { projectId },
    select: { id: true, text: true, chunkIndex: true, embedding: true },
  });

  const scored: ChunkScore[] = chunks
    .map((c) => ({
      chunkId: c.id,
      text: c.text,
      chunkIndex: c.chunkIndex,
      score: cosineSimilarity(queryVec, c.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Cosine ranges -1..1 but a negative score = "even less relevant than orthogonal",
  // which we surface as 0/100 since negative percentages confuse users.
  const retrievabilityScore =
    scored.length > 0 ? Math.max(0, Math.round(scored[0].score * 100)) : 0;

  return { query: queryText, topChunks: scored, retrievabilityScore };
}

/**
 * Score how retrievable a project's site is against all its tracked prompts.
 * Returns one RetrievalResult per prompt, sorted by retrievability descending.
 */
export async function scoreProjectRetrievability(
  projectId: string
): Promise<RetrievalResult[]> {
  const prompts = await prisma.prompt.findMany({
    where: { projectId },
    select: { text: true },
    take: 20, // cap — enough for a meaningful report
  });

  const results = await Promise.all(
    prompts.map((p) => findRelevantChunks(projectId, p.text, 3))
  );

  return results.sort((a, b) => b.retrievabilityScore - a.retrievabilityScore);
}
