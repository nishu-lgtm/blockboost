/**
 * Google Gemini API integration (AI Studio / Generative Language API).
 *
 * Same architectural pattern as lib/perplexity-api.ts: replace flaky
 * scraping with the official API. Drop-in replacement for the Apify
 * Gemini scraper path (which never worked reliably anyway).
 *
 * Default model: gemini-2.5-flash-lite
 *   • Cheapest tier — $0.10/1M input, $0.40/1M output (≈ $0.002 per
 *     10-prompt visibility scan at current PlutoxAI prompt sizes).
 *   • No "thinking" tokens overhead (gemini-2.5-flash has reasoning
 *     mode that bills hidden thinking tokens — flash-lite skips it).
 *   • Verified 2026-05-18: returns substantive responses on PlutoxAI
 *     prompts (including a creative hallucination — "PlutoxAI is a
 *     decentralized Web3 AI platform" — which is itself valuable
 *     visibility signal: AI thinks the brand exists but misidentifies
 *     what it does).
 *
 * Note: free-tier policy varies by model. gemini-2.0-flash returns
 * "limit: 0" on new projects (free tier deprecated). 2.5-flash-lite
 * has its own quota allocation. If quota becomes an issue, swap the
 * model env var (DEFAULT_MODEL) for 2.5-flash or fall back to paid.
 */
import type { ScraperResult } from "@/lib/apify";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const PER_QUERY_TIMEOUT_MS = 30_000;

/** True iff GEMINI_API_KEY is configured. */
export function isGeminiApiAvailable(): boolean {
  const k = process.env.GEMINI_API_KEY;
  return !!k && k.length > 10;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
    // Optional `groundingMetadata.citations[]` when search-grounding is
    // enabled. We don't request grounding by default — adds cost — but
    // we pass through any citations Gemini volunteers.
    groundingMetadata?: {
      citations?: Array<{ uri?: string }>;
      groundingChunks?: Array<{ web?: { uri?: string } }>;
    };
  }>;
  error?: { code: number; message: string };
}

async function runOneQuery(prompt: string): Promise<ScraperResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const url =
    `${GEMINI_API_BASE}/models/${DEFAULT_MODEL}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Keep responses focused so one platform's verbosity doesn't
        // skew mention rates vs ChatGPT.
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.2,
        },
      }),
      signal: AbortSignal.timeout(PER_QUERY_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(
        `[gemini-api] ${res.status} for prompt "${prompt.slice(0, 60)}": ${errText.slice(0, 200)}`
      );
      return null;
    }

    const data = (await res.json()) as GeminiResponse;
    if (data.error) {
      console.warn(`[gemini-api] API error for "${prompt.slice(0, 60)}": ${data.error.message.slice(0, 200)}`);
      return null;
    }

    const candidate = data.candidates?.[0];
    const response = candidate?.content?.parts?.[0]?.text ?? "";
    if (!response) return null;

    // Pull any URI fields Gemini included (groundingMetadata is optional).
    // mention-parser dedupes downstream; we just collect them here.
    const citationUris: string[] = [];
    for (const c of candidate?.groundingMetadata?.citations ?? []) {
      if (c.uri) citationUris.push(c.uri);
    }
    for (const c of candidate?.groundingMetadata?.groundingChunks ?? []) {
      if (c.web?.uri) citationUris.push(c.web.uri);
    }

    return { prompt, response, citations: citationUris };
  } catch (err) {
    console.warn(
      `[gemini-api] Request failed for "${prompt.slice(0, 60)}":`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Same signature and return shape as runChatGPTScraper /
 * runPerplexityApi — drop-in for scan-engine dispatch.
 *
 * Gemini's free-tier rate limit is 15 RPM. We cap concurrency at 5 to
 * stay comfortably under it even with prompt batches up to 50.
 */
export async function runGeminiApi(prompts: string[]): Promise<ScraperResult[]> {
  if (prompts.length === 0) return [];
  if (!isGeminiApiAvailable()) {
    console.warn("[gemini-api] GEMINI_API_KEY not set — skipping Gemini scan");
    return [];
  }

  const CONCURRENCY = 5;
  const results: ScraperResult[] = [];
  const queue = [...prompts];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      const r = await runOneQuery(next);
      if (r) results.push(r);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, prompts.length) }, () => worker())
  );
  return results;
}
