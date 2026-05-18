/**
 * Scan Engine — orchestrates AI platform scraping, mention extraction,
 * citation extraction, and persisting results to the database.
 */

import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";
import { runChatGPTScraper, runPerplexityScraper, runGoogleAIOverviewsScraper } from "@/lib/apify";
import type { ScraperResult } from "@/lib/apify";
import { extractMentions, extractCitations } from "@/lib/mention-parser";
import { aggregateRuns, consensusRunsForPlan, type RunResult } from "@/lib/consensus";
import {
  createScanCompleteAlert,
  createMentionRateDropAlert,
  createCompetitorSurgeAlert,
  createNewCitationAlert,
} from "@/lib/alerts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanSummary {
  totalPrompts: number;
  mentionRate: number;    // 0-100 percentage
  citationsFound: number;
  mentionsCreated: number;
}

// ---------------------------------------------------------------------------
// Plan → platform limits
// ---------------------------------------------------------------------------

/**
 * Returns the set of Platform enum values that should be scanned for a given
 * user plan.
 */
export function platformsForPlan(plan: string): Platform[] {
  // ─────────────────────────────────────────────────────────────────────
  // 2026-05-18 platform availability:
  //
  //   CHATGPT             ✓  Apify tri_angle/gpt-search — verified reliable
  //   PERPLEXITY          ✓  Official Sonar API (lib/perplexity-api.ts)
  //                          — gated on PERPLEXITY_API_KEY env var.
  //                          Replaces the broken Apify actor that
  //                          returned UI chrome instead of real answers.
  //   GOOGLE_AI_OVERVIEWS ✗  Still disabled — unverified Apify actor
  //                          (zhorex/google-ai-overviews-scraper). Same
  //                          risk class as the old Perplexity actor was.
  //                          Re-enable when an API-based path exists or
  //                          a different actor is verified.
  //   GEMINI / COPILOT / GROK ✗  No working scraper or API integration yet.
  //
  // Perplexity is only added to the plan list when the API key is present.
  // Without the key, runScraper falls through to a graceful no-op (empty
  // results, no scan failure).
  // ─────────────────────────────────────────────────────────────────────
  const platforms: Platform[] = [Platform.CHATGPT];

  // Perplexity is universally available on all plans — it's a flat $1/M
  // token API cost we eat as a platform feature rather than gating by plan.
  // Plan-based gating can be added later once we have usage cost data.
  if (process.env.PERPLEXITY_API_KEY) {
    platforms.push(Platform.PERPLEXITY);
  }

  // Gemini via Google AI Studio API (lib/gemini-api.ts) — same rationale.
  // Free tier on gemini-2.5-flash-lite is enough for most users; cost is
  // ≈ $0.002 per 10-prompt scan after free tier.
  if (process.env.GEMINI_API_KEY) {
    platforms.push(Platform.GEMINI);
  }

  // Plan tiers reserved for future capacity controls (e.g., per-platform
  // run counts, additional platforms when GAIO/Gemini scrapers land).
  switch (plan) {
    case "FREE":
    case "STARTER":
    case "GROWTH":
    case "AGENCY":
    case "ENTERPRISE":
    default:
      return platforms;
  }
}

// ---------------------------------------------------------------------------
// Scraper dispatch
// ---------------------------------------------------------------------------

export async function runScraper(
  platform: Platform,
  prompts: string[]
): Promise<{ platform: Platform; results: ScraperResult[] }> {
  let results: ScraperResult[] = [];

  switch (platform) {
    case Platform.CHATGPT:
      results = await runChatGPTScraper(prompts);
      break;
    case Platform.PERPLEXITY: {
      // Use the official Perplexity Sonar API (lib/perplexity-api.ts)
      // instead of the broken Apify actor. Falls back to empty results
      // if PERPLEXITY_API_KEY isn't set in env — graceful no-op rather
      // than burning function time on a feature the deployment isn't
      // configured for.
      const { runPerplexityApi, isPerplexityApiAvailable } = await import(
        "@/lib/perplexity-api"
      );
      if (!isPerplexityApiAvailable()) {
        console.warn("[scan-engine] PERPLEXITY_API_KEY missing — Perplexity skipped");
        results = [];
      } else {
        results = await runPerplexityApi(prompts);
      }
      break;
    }
    case Platform.GOOGLE_AI_OVERVIEWS:
      results = await runGoogleAIOverviewsScraper(prompts);
      break;
    case Platform.GEMINI: {
      // Google AI Studio API (lib/gemini-api.ts) — see comments there
      // for why we use the official API instead of an Apify Gemini scraper.
      const { runGeminiApi, isGeminiApiAvailable } = await import(
        "@/lib/gemini-api"
      );
      if (!isGeminiApiAvailable()) {
        console.warn("[scan-engine] GEMINI_API_KEY missing — Gemini skipped");
        results = [];
      } else {
        results = await runGeminiApi(prompts);
      }
      break;
    }
    // COPILOT, GROK: no working integration yet. Return empty so they
    // don't block. Add API/scraper paths as they become available.
    default:
      console.warn(`[scan-engine] No scraper implemented for platform ${platform}`);
      results = [];
  }

  return { platform, results };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run a full scan for a project.
 *
 * @param projectId  The project to scan
 * @param planOverride  Optional plan string override (defaults to project owner's plan)
 */
export async function runScan(
  projectId: string,
  planOverride?: string
): Promise<ScanSummary> {
  // Snapshot time so we can compare pre-scan vs post-scan mentions
  const scanStartedAt = new Date();

  // ── 1. Fetch project + prompts + competitors ─────────────────────────────
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      prompts: { where: { /* all active prompts */ } },
      competitors: true,
      user: { select: { plan: true, id: true } },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const plan = planOverride ?? project.user.plan;
  const promptTexts = project.prompts.map((p) => p.text);
  const competitorNames = project.competitors.map((c) => c.brandName);
  const enabledPlatforms = platformsForPlan(plan);

  if (promptTexts.length === 0) {
    console.warn(`[scan-engine] Project ${projectId} has no prompts — skipping`);
    return { totalPrompts: 0, mentionRate: 0, citationsFound: 0, mentionsCreated: 0 };
  }

  console.log(
    `[scan-engine] Starting scan for project "${project.brandName}" ` +
      `(${promptTexts.length} prompts × ${enabledPlatforms.length} platforms)`
  );

  // ── 2. Run scrapers N× per platform for consensus ───────────────────────
  // N = consensus runs per plan (see lib/consensus.ts). FREE/STARTER → 1,
  // GROWTH+ → 3. Apify cost scales linearly with N.
  //
  // ALL-SETTLED so one broken platform (e.g. Perplexity actor returning
  // UI chrome instead of answers, or a hung scraper) doesn't discard
  // working platforms' results. The 2026-05-18 Perplexity outage proved
  // why: ChatGPT scrapes succeeded in 8s but their data was abandoned
  // because Promise.all waited 5+ minutes on a doomed Perplexity retry
  // loop, getting killed by Vercel's function timeout. Each platform's
  // results are now independent — if one fails, the others still write.
  const N = consensusRunsForPlan(plan);
  const platformRunResults = await Promise.allSettled(
    enabledPlatforms.map(async (platform) => {
      const runs = await Promise.all(
        Array.from({ length: N }, () => runScraper(platform, promptTexts))
      );
      return { platform, runs };
    })
  );
  const platformRuns = platformRunResults
    .map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(
        `[scan-engine] platform ${enabledPlatforms[i]} failed:`,
        r.reason
      );
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // ── 3. Analyse + aggregate runs, then persist to DB ─────────────────────
  let totalMentions = 0;
  let mentionedCount = 0;
  let totalCitations = 0;
  let mentionsCreated = 0;
  const promptMap = new Map(project.prompts.map((p) => [p.text, p.id]));

  for (const { platform, runs } of platformRuns) {
    if (runs.length === 0) continue;

    for (const promptText of promptTexts) {
      // Collect all run-results for this (prompt, platform) — match by prompt
      // text rather than index, since scraper output order isn't guaranteed
      // identical across runs in flaky/partial-failure cases.
      const sourceResults = runs
        .map((run) => run.results.find((r) => r.prompt === promptText))
        .filter((r): r is NonNullable<typeof r> => !!r);
      if (sourceResults.length === 0) continue;

      // Convert each ScraperResult → RunResult via extractMentions.
      // Sentiment is cached in llm-call (12h TTL keyed on context+brand),
      // so repeated content across runs barely costs anything extra.
      const runResults: RunResult[] = await Promise.all(
        sourceResults.map(async (r) => {
          const analysis = await extractMentions(
            r.response,
            project.brandName,
            competitorNames
          );
          return {
            brandMentioned: analysis.brandMentioned,
            competitorsMentioned: analysis.competitorsMentioned,
            sentiment: analysis.sentiment,
            responseText: r.response,
            mentionRank: analysis.mentionRank,
          };
        })
      );

      const aggregated = aggregateRuns(runResults);
      totalMentions++;
      if (aggregated.brandMentioned) mentionedCount++;

      const promptId = promptMap.get(promptText) ?? project.prompts[0].id;

      // Persist ONE Mention with consensus metadata. We attribute citations
      // to this single row regardless of which underlying run produced them.
      const mention = await prisma.mention.create({
        data: {
          promptId,
          projectId,
          platform,
          brandMentioned: aggregated.brandMentioned,
          competitorsMentioned: aggregated.competitorsMentioned,
          sentiment: aggregated.sentiment,
          responseText: aggregated.responseText,
          mentionRank: aggregated.mentionRank,
          runCount: aggregated.runCount,
          consensusRate: aggregated.consensusRate,
          confidence: aggregated.confidence,
        },
      });
      mentionsCreated++;

      // Citations — union across ALL runs (recall over precision; a URL
      // cited once is still a real signal). Pick the projectDomain once.
      const projectDomain = extractCitationDomain(project.websiteUrl);
      const citationMap = new Map<string, { url: string; domain: string; isOwned: boolean }>();
      for (const r of sourceResults) {
        const inline = extractCitations(r.response, project.websiteUrl);
        for (const c of inline) {
          if (!citationMap.has(c.url)) citationMap.set(c.url, c);
        }
        for (const url of r.citations) {
          if (citationMap.has(url)) continue;
          const domain = extractCitationDomain(url);
          citationMap.set(url, {
            url,
            domain,
            isOwned: domain === projectDomain || domain.endsWith(`.${projectDomain}`),
          });
        }
      }
      const citations = [...citationMap.values()];
      totalCitations += citations.length;

      if (citations.length > 0) {
        await prisma.citation.createMany({
          data: citations.map((c) => ({
            mentionId: mention.id,
            projectId,
            url: c.url,
            domain: c.domain,
            isOwned: c.isOwned,
            platform,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  const mentionRate =
    totalMentions > 0 ? Math.round((mentionedCount / totalMentions) * 100) : 0;

  const summary: ScanSummary = {
    totalPrompts: promptTexts.length,
    mentionRate,
    citationsFound: totalCitations,
    mentionsCreated,
  };

  console.log(`[scan-engine] Scan complete for project ${projectId}:`, summary);

  // ── 4. Generate alerts (fire-and-forget, never block scan result) ─────────
  generateScanAlerts({
    projectId,
    userId: project.user.id,
    summary,
    scanStartedAt,
    enabledPlatforms,
    brandName: project.brandName,
    competitorNames,
  }).catch((err) => {
    console.error("[scan-engine] Alert generation failed:", err);
  });

  return summary;
}

// ---------------------------------------------------------------------------
// Alert generation — runs after scan, compares pre/post metrics
// ---------------------------------------------------------------------------

interface GenerateAlertsInput {
  projectId: string;
  userId: string;
  summary: ScanSummary;
  scanStartedAt: Date;
  enabledPlatforms: Platform[];
  brandName: string;
  competitorNames: string[];
}

async function generateScanAlerts(input: GenerateAlertsInput): Promise<void> {
  const {
    projectId,
    userId,
    summary,
    scanStartedAt,
    enabledPlatforms,
    competitorNames,
  } = input;

  // ── Always fire SCAN_COMPLETE ─────────────────────────────────────────────
  await createScanCompleteAlert(projectId, userId, {
    ...summary,
    platforms: enabledPlatforms.length,
  });

  // ── Fetch previous mentions (before this scan) ────────────────────────────
  const prevMentions = await prisma.mention.findMany({
    where: { projectId, createdAt: { lt: scanStartedAt } },
    select: {
      brandMentioned: true,
      competitorsMentioned: true,
      platform: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500, // cap to recent history
  });

  if (prevMentions.length < 10) {
    // Not enough history to make meaningful comparisons
    return;
  }

  // Previous overall mention rate
  const prevMentioned = prevMentions.filter((m) => m.brandMentioned).length;
  const prevRate = Math.round((prevMentioned / prevMentions.length) * 100);

  // ── MENTION_RATE_DROP: drop > 10pp ───────────────────────────────────────
  const drop = prevRate - summary.mentionRate;
  if (drop > 10) {
    await createMentionRateDropAlert(projectId, userId, prevRate, summary.mentionRate);
  }

  // ── COMPETITOR_SURGE: any competitor increases > 15pp ────────────────────
  const newMentions = await prisma.mention.findMany({
    where: { projectId, createdAt: { gte: scanStartedAt } },
    select: { competitorsMentioned: true },
  });

  for (const competitor of competitorNames) {
    const prevCount = prevMentions.filter((m) =>
      m.competitorsMentioned.some((c) => c.toLowerCase() === competitor.toLowerCase())
    ).length;
    const newCount = newMentions.filter((m) =>
      m.competitorsMentioned.some((c) => c.toLowerCase() === competitor.toLowerCase())
    ).length;

    if (newMentions.length === 0 || prevMentions.length === 0) continue;

    const prevCompRate = Math.round((prevCount / prevMentions.length) * 100);
    const newCompRate = Math.round((newCount / newMentions.length) * 100);

    if (newCompRate - prevCompRate > 15) {
      await createCompetitorSurgeAlert(projectId, userId, competitor, prevCompRate, newCompRate);
    }
  }

  // ── NEW_CITATION: domains not seen in previous citations ─────────────────
  const [prevDomains, newCitations] = await Promise.all([
    prisma.citation.findMany({
      where: { projectId, createdAt: { lt: scanStartedAt } },
      select: { domain: true },
      distinct: ["domain"],
    }),
    prisma.citation.findMany({
      where: { projectId, createdAt: { gte: scanStartedAt } },
      select: { domain: true, platform: true },
      distinct: ["domain"],
    }),
  ]);

  const prevDomainSet = new Set(prevDomains.map((c) => c.domain));
  for (const citation of newCitations) {
    if (!prevDomainSet.has(citation.domain)) {
      await createNewCitationAlert(projectId, userId, citation.domain, citation.platform);
    }
  }
}

// ---------------------------------------------------------------------------
// Small local helper (duplicated from mention-parser to avoid circular imports)
// ---------------------------------------------------------------------------

function extractCitationDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
