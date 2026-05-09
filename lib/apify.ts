/**
 * Apify client wrapper for AI platform scrapers.
 * Each scraper runs on Apify actors, waits for completion, and returns
 * structured results: { prompt, response, citations }.
 */

const APIFY_API_BASE = "https://api.apify.com/v2";

export interface ScraperResult {
  prompt: string;
  response: string;
  citations: string[]; // raw URLs found in the response
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not set");
  return token;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an Apify actor synchronously (waits up to `timeoutSecs` for the run to
 * finish, then fetches the dataset items).
 *
 * Uses the `/runs/sync-get-dataset-items` convenience endpoint so we avoid
 * polling loops in most cases, with a manual retry wrapper for resilience.
 */
async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  timeoutSecs = 300
): Promise<unknown[]> {
  const token = getToken();
  const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}&format=json`;

  const MAX_ATTEMPTS = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        // Node fetch signal for overall timeout (timeoutSecs + 30s buffer)
        signal: AbortSignal.timeout((timeoutSecs + 30) * 1000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "(unreadable)");
        throw new Error(`Apify actor ${actorId} returned ${res.status}: ${text}`);
      }

      const data = (await res.json()) as unknown[];
      return data;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        // Exponential back-off: 2s, 4s
        await sleep(2 ** attempt * 1000);
        console.warn(
          `[apify] Attempt ${attempt} failed for actor ${actorId}, retrying…`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  console.error(`[apify] All ${MAX_ATTEMPTS} attempts failed for actor ${actorId}`, lastError);
  return [];
}

/**
 * Extract URLs from an actor result item.  Different actors use different
 * field names for citations/sources.
 */
function extractCitationUrls(item: Record<string, unknown>): string[] {
  // Try common field names used by various Apify AI scraper actors
  const candidates: unknown = item.citations ?? item.sources ?? item.links ?? item.urls ?? [];
  if (Array.isArray(candidates)) {
    return candidates
      .map((c) => (typeof c === "string" ? c : (c as Record<string, unknown>)?.url ?? ""))
      .filter((u): u is string => typeof u === "string" && u.startsWith("http"));
  }
  return [];
}

/**
 * Normalize a raw actor dataset item into our ScraperResult shape.
 * Actors often use slightly different field names.
 */
function normalizeResult(
  item: Record<string, unknown>,
  promptFallback: string
): ScraperResult {
  const prompt =
    typeof item.prompt === "string"
      ? item.prompt
      : typeof item.query === "string"
      ? item.query
      : promptFallback;

  const response =
    typeof item.response === "string"
      ? item.response
      : typeof item.answer === "string"
      ? item.answer
      : typeof item.text === "string"
      ? item.text
      : "";

  return { prompt, response, citations: extractCitationUrls(item) };
}

// ---------------------------------------------------------------------------
// Public scraper functions
// ---------------------------------------------------------------------------

/**
 * Run the ChatGPT / OpenAI scraper on Apify.
 * Actor: tri_angle/gpt-search (265k+ runs, the most battle-tested public
 * ChatGPT scraper on Apify. Takes a `prompts` array, returns one item
 * per prompt with the AI-generated text.)
 */
export async function runChatGPTScraper(
  prompts: string[]
): Promise<ScraperResult[]> {
  if (prompts.length === 0) return [];
  try {
    const items = await runActor("tri_angle/gpt-search", {
      prompts,
      country: "US",
    });

    return items.map((item, i) =>
      normalizeResult(item as Record<string, unknown>, prompts[i] ?? "")
    );
  } catch (err) {
    console.error("[apify] ChatGPT scraper failed:", err);
    return [];
  }
}

/**
 * Run the Perplexity scraper on Apify.
 * Actor: zhorex/perplexity-ai-scraper. Takes `queries` array in "search"
 * mode and returns one item per query with the answer + citations.
 */
export async function runPerplexityScraper(
  prompts: string[]
): Promise<ScraperResult[]> {
  if (prompts.length === 0) return [];
  try {
    const items = await runActor("zhorex/perplexity-ai-scraper", {
      mode: "search",
      queries: prompts,
      maxQueries: prompts.length,
    });

    return items.map((item, i) =>
      normalizeResult(item as Record<string, unknown>, prompts[i] ?? "")
    );
  } catch (err) {
    console.error("[apify] Perplexity scraper failed:", err);
    return [];
  }
}

/**
 * Run the Google AI Overviews scraper on Apify.
 * Actor: apify/google-search-scraper  (AI Overview field included since 2024)
 */
export async function runGoogleAIOverviewsScraper(
  prompts: string[]
): Promise<ScraperResult[]> {
  if (prompts.length === 0) return [];
  try {
    const items = await runActor("apify/google-search-scraper", {
      queries: prompts.join("\n"),
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
      outputAiOverview: true,
      countryCode: "us",
      languageCode: "en",
    });

    // Google actor returns one item per query; extract the AI overview field.
    return items.map((item, i) => {
      const raw = item as Record<string, unknown>;
      const overview =
        typeof raw.aiOverview === "string"
          ? raw.aiOverview
          : typeof raw.aiGeneratedAnswer === "string"
          ? raw.aiGeneratedAnswer
          : "";

      const citations: string[] = [];
      const citationSrc =
        raw.aiOverviewCitations ?? raw.aiGeneratedAnswerLinks ?? [];
      if (Array.isArray(citationSrc)) {
        for (const c of citationSrc) {
          const u =
            typeof c === "string"
              ? c
              : (c as Record<string, unknown>)?.url ?? "";
          if (typeof u === "string" && u.startsWith("http")) citations.push(u);
        }
      }

      return {
        prompt: prompts[i] ?? "",
        response: overview,
        citations,
      };
    });
  } catch (err) {
    console.error("[apify] Google AI Overviews scraper failed:", err);
    return [];
  }
}
