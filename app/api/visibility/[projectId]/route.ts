import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Platform, Sentiment } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types returned to the client
// ---------------------------------------------------------------------------

export interface PlatformRate {
  platform: string;
  rate: number;          // 0-100
  mentionCount: number;
  totalCount: number;
}

export interface TimeSeriesPoint {
  date: string;          // "YYYY-MM-DD"
  [platform: string]: number | string; // platform → rate
}

export interface PromptResult {
  platform: string;
  mentioned: boolean;
  responseText: string;
  sentiment: string;
  mentionRank: number | null;
}

export interface PromptRow {
  promptId: string;
  promptText: string;
  category: string;
  results: PromptResult[];
  avgMentionRate: number; // 0-100
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface SummaryMetrics {
  overallRate: number;    // 0-100
  bestPlatform: string | null;
  totalCitations: number;
  shareOfVoice: number;   // 0-100 (brand rate / (brand+competitors average))
}

export interface VisibilityData {
  projectId: string;
  projectName: string;
  brandName: string;
  lastScanAt: string | null;
  summaryMetrics: SummaryMetrics;
  mentionRateByPlatform: PlatformRate[];
  mentionRateOverTime: TimeSeriesPoint[];
  promptBreakdown: PromptRow[];
  sentimentBreakdown: SentimentBreakdown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_PLATFORMS: Platform[] = [
  Platform.CHATGPT,
  Platform.PERPLEXITY,
  Platform.GEMINI,
  Platform.COPILOT,
  Platform.GROK,
  Platform.GOOGLE_AI_OVERVIEWS,
];

const PLATFORM_LABELS: Record<Platform, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  GEMINI: "Gemini",
  COPILOT: "Copilot",
  GROK: "Grok",
  GOOGLE_AI_OVERVIEWS: "Google AIO",
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;

    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: {
        prompts: { orderBy: { createdAt: "asc" } },
        competitors: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch all mentions for this project (last 30 days for time-series; all for aggregates)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Cap analysis to last 90 days to prevent unbounded loads as data grows.
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [allMentions, recentMentions, citations] = await Promise.all([
      prisma.mention.findMany({
        where: { projectId, createdAt: { gte: ninetyDaysAgo } },
        select: {
          id: true,
          promptId: true,
          platform: true,
          brandMentioned: true,
          competitorsMentioned: true,
          sentiment: true,
          responseText: true,
          mentionRank: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.mention.findMany({
        where: { projectId, createdAt: { gte: thirtyDaysAgo } },
        select: {
          platform: true,
          brandMentioned: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.citation.count({
        where: { projectId },
      }),
    ]);

    // ── 1. Summary metrics ───────────────────────────────────────────────
    const totalMentions = allMentions.length;
    const brandMentioned = allMentions.filter((m) => m.brandMentioned).length;
    const overallRate =
      totalMentions > 0 ? Math.round((brandMentioned / totalMentions) * 100) : 0;

    // ── 2. Mention rate by platform ──────────────────────────────────────
    const platformMap = new Map<Platform, { mentioned: number; total: number }>();
    for (const m of allMentions) {
      const cur = platformMap.get(m.platform) ?? { mentioned: 0, total: 0 };
      cur.total++;
      if (m.brandMentioned) cur.mentioned++;
      platformMap.set(m.platform, cur);
    }

    const mentionRateByPlatform: PlatformRate[] = ALL_PLATFORMS.map((p) => {
      const counts = platformMap.get(p) ?? { mentioned: 0, total: 0 };
      return {
        platform: PLATFORM_LABELS[p],
        rate: counts.total > 0 ? Math.round((counts.mentioned / counts.total) * 100) : 0,
        mentionCount: counts.mentioned,
        totalCount: counts.total,
      };
    }).filter((p) => p.totalCount > 0);

    const bestPlatform =
      mentionRateByPlatform.length > 0
        ? mentionRateByPlatform.reduce((a, b) => (a.rate >= b.rate ? a : b)).platform
        : null;

    // ── 3. Share of Voice ────────────────────────────────────────────────
    // SOV = brand_mention_count / (brand + competitor_mention_count combined)
    // We estimate competitor appearances by scanning competitorsMentioned arrays.
    let competitorTotalAppearances = 0;
    for (const m of allMentions) {
      competitorTotalAppearances += m.competitorsMentioned.length;
    }
    const totalVoice = brandMentioned + competitorTotalAppearances;
    const shareOfVoice =
      totalVoice > 0 ? Math.round((brandMentioned / totalVoice) * 100) : 0;

    const summaryMetrics: SummaryMetrics = {
      overallRate,
      bestPlatform,
      totalCitations: citations,
      shareOfVoice,
    };

    // ── 4. Mention rate over time (last 30 days) ─────────────────────────
    // Build a map: date → platform → {mentioned, total}
    type DayPlatformMap = Map<string, Map<string, { mentioned: number; total: number }>>;
    const dayMap: DayPlatformMap = new Map();

    for (const m of recentMentions) {
      const day = m.createdAt.toISOString().slice(0, 10); // "YYYY-MM-DD"
      const platformLabel = PLATFORM_LABELS[m.platform];
      if (!dayMap.has(day)) dayMap.set(day, new Map());
      const pm = dayMap.get(day)!;
      const cur = pm.get(platformLabel) ?? { mentioned: 0, total: 0 };
      cur.total++;
      if (m.brandMentioned) cur.mentioned++;
      pm.set(platformLabel, cur);
    }

    // Generate date range
    const dates: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const platformsWithData = [
      ...new Set(recentMentions.map((m) => PLATFORM_LABELS[m.platform])),
    ];

    const mentionRateOverTime: TimeSeriesPoint[] = dates.map((date) => {
      const point: TimeSeriesPoint = { date };
      for (const pl of platformsWithData) {
        const pm = dayMap.get(date)?.get(pl);
        point[pl] = pm ? Math.round((pm.mentioned / pm.total) * 100) : 0;
      }
      return point;
    });

    // ── 5. Prompt breakdown ──────────────────────────────────────────────
    // Pre-bucket mentions by promptId once → O(N), so the per-prompt loop
    // doesn't filter the full array on every iteration (used to be O(P×N)).
    const mentionsByPrompt = new Map<string, typeof allMentions>();
    for (const m of allMentions) {
      if (!m.promptId) continue;
      const arr = mentionsByPrompt.get(m.promptId);
      if (arr) arr.push(m);
      else mentionsByPrompt.set(m.promptId, [m]);
    }

    const promptBreakdown: PromptRow[] = project.prompts.map((prompt) => {
      const promptMentions = mentionsByPrompt.get(prompt.id) ?? [];

      const resultsByPlatform = new Map<string, PromptResult>();
      for (const m of promptMentions) {
        const pl = PLATFORM_LABELS[m.platform];
        // Keep the most recent mention per platform for this prompt
        if (!resultsByPlatform.has(pl)) {
          resultsByPlatform.set(pl, {
            platform: pl,
            mentioned: m.brandMentioned,
            responseText: m.responseText,
            sentiment: m.sentiment,
            mentionRank: m.mentionRank,
          });
        }
      }

      const results = [...resultsByPlatform.values()];
      const mentioned = results.filter((r) => r.mentioned).length;
      const avgMentionRate =
        results.length > 0 ? Math.round((mentioned / results.length) * 100) : 0;

      return {
        promptId: prompt.id,
        promptText: prompt.text,
        category: prompt.category,
        results,
        avgMentionRate,
      };
    });

    // ── 6. Sentiment breakdown ───────────────────────────────────────────
    const brandMentions = allMentions.filter((m) => m.brandMentioned);
    const sentimentBreakdown: SentimentBreakdown = {
      positive: brandMentions.filter((m) => m.sentiment === Sentiment.POSITIVE).length,
      neutral: brandMentions.filter((m) => m.sentiment === Sentiment.NEUTRAL).length,
      negative: brandMentions.filter((m) => m.sentiment === Sentiment.NEGATIVE).length,
    };

    // ── 7. Last scan timestamp ───────────────────────────────────────────
    const lastMention = allMentions[0]; // sorted desc by createdAt
    const lastScanAt = lastMention?.createdAt.toISOString() ?? null;

    const data: VisibilityData = {
      projectId,
      projectName: project.name,
      brandName: project.brandName,
      lastScanAt,
      summaryMetrics,
      mentionRateByPlatform,
      mentionRateOverTime,
      promptBreakdown,
      sentimentBreakdown,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Visibility API error:", error);
    return NextResponse.json({ error: "Failed to load visibility data." }, { status: 500 });
  }
}
