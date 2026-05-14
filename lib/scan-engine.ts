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
  switch (plan) {
    case "FREE":
      // Free tier: one platform only
      return [Platform.CHATGPT];
    case "STARTER":
      // Starter: 3 platforms
      return [Platform.CHATGPT, Platform.PERPLEXITY, Platform.GOOGLE_AI_OVERVIEWS];
    case "GROWTH":
    case "AGENCY":
    case "ENTERPRISE":
    default:
      // Currently 3 supported platforms. GEMINI/COPILOT/GROK lack scrapers
      // and would just return empty data, so we exclude them from automatic
      // scans rather than burn API calls and show "0% mention rate" tiles.
      return [
        Platform.CHATGPT,
        Platform.PERPLEXITY,
        Platform.GOOGLE_AI_OVERVIEWS,
      ];
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
    case Platform.PERPLEXITY:
      results = await runPerplexityScraper(prompts);
      break;
    case Platform.GOOGLE_AI_OVERVIEWS:
      results = await runGoogleAIOverviewsScraper(prompts);
      break;
    // GEMINI, COPILOT, GROK: actor integrations can be added here as they
    // become available on Apify.  Return empty for now so they don't block.
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
  const N = consensusRunsForPlan(plan);
  const platformRuns = await Promise.all(
    enabledPlatforms.map(async (platform) => {
      const runs = await Promise.all(
        Array.from({ length: N }, () => runScraper(platform, promptTexts))
      );
      return { platform, runs };
    })
  );

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
