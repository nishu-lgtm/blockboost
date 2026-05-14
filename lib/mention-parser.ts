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
  const brandMentioned = lower.includes(brandName.toLowerCase());

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
