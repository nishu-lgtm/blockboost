/**
 * Perplexity Sonar API integration.
 *
 * Replaces the unusable Apify zhorex/perplexity-ai-scraper actor that
 * (a) timed out at 90s/query and (b) returned UI chrome ("Cookie Policy",
 * "Thinking") instead of real responses. Discovered 2026-05-18.
 *
 * Perplexity exposes an OpenAI-compatible chat completions endpoint
 * (https://api.perplexity.ai/chat/completions) with the `sonar` family
 * of models. Returns the model's answer + source URLs in one JSON call,
 * typically completing in 5-15 seconds per query — well within scan-engine
 * budgets, no scraping fragility, deterministic schema.
 *
 * Same return shape as the existing Apify wrappers (`ScraperResult[]`),
 * so scan-engine doesn't need to know it's an API call instead of a
 * scraper.
 */
import type { ScraperResult } from "@/lib/apify";

const PERPLEXITY_API_BASE = "https://api.perplexity.ai/chat/completions";
const DEFAULT_MODEL = "sonar"; // cheapest tier — $1/1M tokens both ways
const PER_QUERY_TIMEOUT_MS = 30_000; // one query should resolve well under 30s

/**
 * True if PERPLEXITY_API_KEY is configured. Use as a guard before adding
 * Perplexity to platformsForPlan in scan-engine.
 */
export function isPerplexityApiAvailable(): boolean {
  const k = process.env.PERPLEXITY_API_KEY;
  return !!k && k.length > 10;
}

interface SonarResponse {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
  // sonar-pro+ also returns `search_results` and `usage` — we don't need them
}

/**
 * Run one prompt through the Sonar API. Returns null on any error
 * (timeout, 4xx, malformed JSON) so the caller can collect partial
 * results across many prompts without one failure aborting all.
 */
async function runOneQuery(prompt: string): Promise<ScraperResult | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(PERPLEXITY_API_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: "user", content: prompt }],
        // Keep responses focused — same prompts ChatGPT scraper sees, so
        // we don't want one platform's verbosity to skew mention rates.
        max_tokens: 1024,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(PER_QUERY_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(
        `[perplexity-api] ${res.status} for prompt "${prompt.slice(0, 60)}": ${errText.slice(0, 200)}`
      );
      return null;
    }

    const data = (await res.json()) as SonarResponse;
    const response = data.choices?.[0]?.message?.content ?? "";
    if (!response) return null;

    // Perplexity returns sources separately from the message body. We pass
    // them through verbatim; extractCitations in mention-parser will
    // dedupe by URL the same way it does for Apify-sourced URLs.
    const citations = Array.isArray(data.citations) ? data.citations : [];

    return { prompt, response, citations };
  } catch (err) {
    console.warn(
      `[perplexity-api] Request failed for prompt "${prompt.slice(0, 60)}":`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Run all prompts in parallel against the Sonar API. Same signature/return
 * shape as `runChatGPTScraper` and the other Apify wrappers — drop-in
 * replacement for the broken `runPerplexityScraper`.
 *
 * Concurrency cap: 5 in-flight requests at a time. Perplexity's rate
 * limit for free-tier API keys is 50 req/min so 5 concurrent leaves
 * plenty of headroom even if a project has 50 prompts.
 */
export async function runPerplexityApi(
  prompts: string[]
): Promise<ScraperResult[]> {
  if (prompts.length === 0) return [];
  if (!isPerplexityApiAvailable()) {
    console.warn("[perplexity-api] PERPLEXITY_API_KEY not set — skipping Perplexity scan");
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

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, prompts.length) }, () => worker()));
  return results;
}
