/**
 * Mention Parser — analyse a raw AI response text to extract:
 *   - Whether the brand is mentioned
 *   - Which competitors are mentioned
 *   - Sentiment around the brand mention (via OpenAI)
 *   - Mention rank (ordinal position among brand/competitor mentions)
 *   - Citations (URLs) and whether they are owned by the project
 */

import { z } from "zod";
import { llmCall, isLlmAvailable } from "@/lib/llm-call";
import { embedCall, cosineSimilarity, isEmbeddingAvailable, BRAND_SIMILARITY_THRESHOLD } from "@/lib/embeddings";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MentionAnalysis {
  brandMentioned: boolean;
  competitorsMentioned: string[];
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "NOT_MENTIONED";
  mentionRank: number | null;
}

export interface CitationInfo {
  url: string;
  domain: string;
  isOwned: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the registrable domain from a URL string. */
function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    // Strip leading www.
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Extract all http(s) URLs from a body of text. */
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s\])"'>]+/g;
  return [...new Set(text.match(urlRegex) ?? [])];
}

/**
 * Find the ordinal rank at which the brand (or first competitor) appears
 * among all brand/competitor occurrences in the text.
 *
 * Returns the 1-based index of the BRAND mention in the ordered list of
 * brand+competitor mentions, or null if the brand is not mentioned.
 */
function computeMentionRank(
  text: string,
  brandName: string,
  competitors: string[]
): number | null {
  const lower = text.toLowerCase();
  const brandLower = brandName.toLowerCase();

  // Collect positions of all brand + competitor occurrences
  const positions: Array<{ name: string; index: number }> = [];

  // Brand positions
  let idx = lower.indexOf(brandLower);
  while (idx !== -1) {
    positions.push({ name: brandName, index: idx });
    idx = lower.indexOf(brandLower, idx + 1);
  }

  // Competitor positions
  for (const comp of competitors) {
    const compLower = comp.toLowerCase();
    let ci = lower.indexOf(compLower);
    while (ci !== -1) {
      positions.push({ name: comp, index: ci });
      ci = lower.indexOf(compLower, ci + 1);
    }
  }

  if (positions.length === 0) return null;

  // Sort by position in text
  positions.sort((a, b) => a.index - b.index);

  // Deduplicate consecutive runs of the same name (e.g. brand repeated many times)
  const deduplicated: string[] = [];
  for (const p of positions) {
    if (deduplicated[deduplicated.length - 1] !== p.name) {
      deduplicated.push(p.name);
    }
  }

  const rank = deduplicated.indexOf(brandName) + 1; // 0 means not found → 0+1-1 = 0
  return rank > 0 ? rank : null;
}

// ---------------------------------------------------------------------------
// OpenAI sentiment analysis (via lib/llm-call wrapper)
// ---------------------------------------------------------------------------

/** Extract a ~300-char window around the first brand mention for context. */
function extractContext(text: string, brandName: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(brandName.toLowerCase());
  if (idx === -1) return text.slice(0, 500);
  const start = Math.max(0, idx - 150);
  const end = Math.min(text.length, idx + brandName.length + 150);
  return text.slice(start, end);
}

const sentimentSchema = z.object({
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
});

async function classifySentiment(
  responseText: string,
  brandName: string
): Promise<"POSITIVE" | "NEUTRAL" | "NEGATIVE"> {
  // Cheap heuristic fallback — used when no API key, moderation block, etc.
  const heuristic = (): "POSITIVE" | "NEUTRAL" | "NEGATIVE" => {
    const ctx = extractContext(responseText, brandName).toLowerCase();
    const positiveWords = ["recommend", "best", "great", "excellent", "top", "leading", "trusted"];
    const negativeWords = ["avoid", "bad", "poor", "worst", "not recommend", "issues", "problem"];
    const posHits = positiveWords.filter((w) => ctx.includes(w)).length;
    const negHits = negativeWords.filter((w) => ctx.includes(w)).length;
    if (posHits > negHits) return "POSITIVE";
    if (negHits > posHits) return "NEGATIVE";
    return "NEUTRAL";
  };

  if (!isLlmAvailable()) return heuristic();

  const context = extractContext(responseText, brandName);
  const result = await llmCall({
    feature: "mention-parser:sentiment",
    model: "fast",
    schema: sentimentSchema,
    fallback: { sentiment: heuristic() },
    cacheTtlSec: 12 * 60 * 60,
    temperature: 0,
    maxTokens: 20,
    messages: [
      {
        role: "system",
        content:
          'You are a sentiment classifier. Given a text excerpt from an AI assistant response and a brand name, classify the sentiment toward that brand as POSITIVE, NEUTRAL, or NEGATIVE. Respond with JSON: { "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE" }.',
      },
      { role: "user", content: `Brand: ${brandName}\n\nText excerpt:\n${context}` },
    ],
  });
  return result.data.sentiment;
}

// ---------------------------------------------------------------------------
// Hybrid brand detection — exact match fast path + embedding fallback
// ---------------------------------------------------------------------------

// Apostrophe character class — ChatGPT outputs curly Unicode apostrophes
// (U+2019, ’) rather than plain ASCII ('). Matching only ASCII silently
// missed every disclaimer in production. Use this in every regex below
// instead of a bare `'`.
const APOS = "['’]";

// Phrases that indicate the AI explicitly DOESN'T know about the brand —
// even though the brand name appears in the response (echoed from the
// user's question). nishuprasad75 surfaced this on 2026-05-16: the parser
// was counting "I don't have information about PlutoxAI" as a real mention,
// inflating the dashboard to 100% mention rate. These regex patterns
// require the brand name to be near the disclaimer (same ~200-char window).
const DISCLAIMER_PATTERNS = [
  new RegExp(`\\bI (?:don${APOS}?t|do not|cannot|can${APOS}?t|couldn${APOS}?t|wasn${APOS}?t|am not) (?:have|find|know|recognize|currently have)\\b`, "i"),
  new RegExp(`\\bI${APOS}?m not (?:familiar|aware) (?:with|of)\\b`, "i"),
  new RegExp(`\\bI (?:have|haven${APOS}?t had) (?:no|any) (?:information|knowledge|details|data) (?:about|on|of|for|regarding)\\b`, "i"),
  new RegExp(`\\bThere${APOS}?s no (?:reliable |publicly available |verifiable )?(?:information|data|details|public information) (?:about|on|for)\\b`, "i"),
  new RegExp(`\\bI (?:wasn${APOS}?t|was not) able to (?:find|locate|verify)\\b`, "i"),
  /\bnot (?:a |an )?(?:real|established|well-known|recognized) (?:company|product|platform|brand|tool)\b/i,
  /\b(?:no|insufficient|limited) information (?:is |was )?available (?:about|on)\b/i,
];

/**
 * Returns true if the response contains a disclaimer phrase near a brand
 * mention. Phrases must appear within ~200 characters of the brand name
 * to count — otherwise unrelated disclaimers elsewhere in the response
 * would suppress real mentions.
 */
function hasNearbyDisclaimer(text: string, brand: string): boolean {
  const brandLower = brand.toLowerCase();
  const lower = text.toLowerCase();
  const brandIdx = lower.indexOf(brandLower);
  if (brandIdx === -1) return false;

  // ±200 chars around the FIRST brand mention. If there are multiple
  // mentions and at least one is in a non-disclaimer context, we should
  // still count it — but in practice these AI responses are dominated by
  // a single disclaimer or a single recommendation, not both.
  const start = Math.max(0, brandIdx - 200);
  const end = Math.min(text.length, brandIdx + brand.length + 200);
  const window = text.slice(start, end);

  return DISCLAIMER_PATTERNS.some((p) => p.test(window));
}

/**
 * Normalise a brand name for fuzzy substring matching: lowercase, strip
 * spaces, dashes, dots. Catches "Pluto X AI" or "Pluto-AI" → "plutoxai".
 */
function normaliseBrand(s: string): string {
  return s.toLowerCase().replace(/[\s\-._]/g, "");
}

/**
 * Returns true if `brand` is genuinely present in `text`.
 *
 *   1. Exact substring match (case-insensitive)        →  definitive
 *   2. Normalised substring match (spaces/dashes etc)  →  catches typos
 *   3. Embedding fallback                              →  ONLY when brand
 *                                                         has no presence
 *                                                         in either form,
 *                                                         AND cosine >= 0.75
 *                                                         (was 0.30 before
 *                                                         — too loose, gave
 *                                                         false positives
 *                                                         on generic AI-tool
 *                                                         articles).
 *
 * After determining presence, check for a "I don't know about X" disclaimer
 * near the brand. If present, treat as NOT mentioned — those responses
 * actively HURT visibility, not help it.
 */
async function isBrandPresent(text: string, brand: string): Promise<boolean> {
  const exactHit = text.toLowerCase().includes(brand.toLowerCase());
  const normHit = !exactHit && normaliseBrand(text).includes(normaliseBrand(brand));

  let mentioned = exactHit || normHit;

  // Embedding fallback — kept but only fires when no string match at all
  // AND uses a much stricter threshold (was 0.30, now 0.75). The previous
  // threshold caught generic AI-tool articles as "matching" PlutoxAI just
  // because they were in the same semantic space.
  if (!mentioned && isEmbeddingAvailable()) {
    const [brandVec, textVec] = await Promise.all([
      embedCall(brand),
      embedCall(text.slice(0, 2000)),
    ]);
    if (brandVec.length > 0 && textVec.length > 0) {
      const sim = cosineSimilarity(brandVec, textVec);
      // STRICT threshold for fallback. 0.75 is high enough that only near-
      // identical content (typos, variant spellings of the brand) matches.
      mentioned = sim >= 0.75;
    }
  }

  if (!mentioned) return false;

  // Disclaimer guard: even if the brand appears literally, "I don't have
  // information about PlutoxAI" is NOT a positive citation — it's the
  // opposite. Suppress these false positives.
  if (hasNearbyDisclaimer(text, brand)) return false;

  return true;
}

// Exported for tests so we can lock the false-positive fixes in place.
export const __testExports = { hasNearbyDisclaimer, normaliseBrand, isBrandPresent };

// Silence unused-import: BRAND_SIMILARITY_THRESHOLD is no longer used here
// (we use 0.75 inline instead) but keep the import resolvable.
void BRAND_SIMILARITY_THRESHOLD;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse an AI response to determine brand/competitor mentions and sentiment.
 */
export async function extractMentions(
  responseText: string,
  brandName: string,
  competitors: string[]
): Promise<MentionAnalysis> {
  const lower = responseText.toLowerCase();
  const brandMentioned = await isBrandPresent(responseText, brandName);

  const competitorsMentioned = competitors.filter((c) =>
    lower.includes(c.toLowerCase())
  );

  if (!brandMentioned) {
    return {
      brandMentioned: false,
      competitorsMentioned,
      sentiment: "NOT_MENTIONED",
      mentionRank: null,
    };
  }

  const [sentiment, mentionRank] = await Promise.all([
    classifySentiment(responseText, brandName),
    Promise.resolve(computeMentionRank(responseText, brandName, competitors)),
  ]);

  return { brandMentioned, competitorsMentioned, sentiment, mentionRank };
}

/**
 * Extract and classify citation URLs from an AI response.
 *
 * @param responseText   The raw response string (may also include inline-markdown links)
 * @param projectWebsiteUrl  The project's own website (e.g. "https://acmecorp.com")
 */
export function extractCitations(
  responseText: string,
  projectWebsiteUrl: string
): CitationInfo[] {
  const projectDomain = extractDomain(projectWebsiteUrl);
  const urls = extractUrls(responseText);

  return urls.map((url) => {
    const domain = extractDomain(url);
    const isOwned = domain === projectDomain || domain.endsWith(`.${projectDomain}`);
    return { url, domain, isOwned };
  });
}
