/**
 * Scan Engine — orchestrates AI platform scraping, mention extraction,
 * citation extraction, and persisting results to the database.
 */

import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";
import { runChatGPTScraper, runPerplexityScraper, runGoogleAIOverviewsScraper } from "@/lib/apify";
import type { ScraperResult } from "@/lib/apify";
import { extractMentions, extractCitations } from "@/lib/mention-parser";
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
      // Growth: 6 platforms (all currently supported)
      return [
        Platform.CHATGPT,
        Platform.PERPLEXITY,
        Platform.GOOGLE_AI_OVERVIEWS,
        Platform.GEMINI,
        Platform.COPILOT,
        Platform.GROK,
      ];
    case "ENTERPRISE":
    default:
      return [
        Platform.CHATGPT,
        Platform.PERPLEXITY,
        Platform.GOOGLE_AI_OVERVIEWS,
        Platform.GEMINI,
        Platform.COPILOT,
        Platform.GROK,
      ];
  }
}

// ---------------------------------------------------------------------------
// Scraper dispatch
// ---------------------------------------------------------------------------

async function runScraper(
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

  // ── 2. Run all scrapers in parallel ──────────────────────────────────────
  const scraperJobs = enabledPlatforms.map((platform) =>
    runScraper(platform, promptTexts)
  );
  const scraperOutputs = await Promise.all(scraperJobs);

  // ── 3. Analyse results and persist to DB ─────────────────────────────────
  let totalMentions = 0;
  let mentionedCount = 0;
  let totalCitations = 0;
  let mentionsCreated = 0;

  for (const { platform, results } of scraperOutputs) {
    if (results.length === 0) continue;

    // Find the Prompt record for each result (match by text)
    const promptMap = new Map(project.prompts.map((p) => [p.text, p.id]));

    for (const result of results) {
      totalMentions++;

      // Match prompt text → prompt DB id (fallback: first prompt)
      const promptId = promptMap.get(result.prompt) ?? project.prompts[0].id;

      // Analyse mention
      const analysis = await extractMentions(
        result.response,
        project.brandName,
        competitorNames
      );

      if (analysis.brandMentioned) mentionedCount++;

      // Persist Mention
      const mention = await prisma.mention.create({
        data: {
          promptId,
          projectId,
          platform,
          brandMentioned: analysis.brandMentioned,
          competitorsMentioned: analysis.competitorsMentioned,
          sentiment: analysis.sentiment,
          responseText: result.response,
          mentionRank: analysis.mentionRank,
        },
      });
      mentionsCreated++;

      // Extract citations from scraper-provided URLs + inline text URLs
      const inlineFromText = extractCitations(result.response, project.websiteUrl);
      const fromScraperUrls = result.citations.map((url) => {
        const domain = extractCitationDomain(url);
        const projectDomain = extractCitationDomain(project.websiteUrl);
        const isOwned = domain === projectDomain || domain.endsWith(`.${projectDomain}`);
        return { url, domain, isOwned };
      });

      // Merge (deduplicate by URL)
      const citationMap = new Map<string, { url: string; domain: string; isOwned: boolean }>();
      for (const c of [...inlineFromText, ...fromScraperUrls]) {
        if (!citationMap.has(c.url)) citationMap.set(c.url, c);
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
