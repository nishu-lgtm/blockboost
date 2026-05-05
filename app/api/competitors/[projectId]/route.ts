import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Platform, Plan } from "@prisma/client";
import type {
  CompetitorData,
  SoVPlatformBar,
  H2HPromptRow,
  H2HSummary,
  TrendPoint,
  GapRow,
  CitationSourceRow,
} from "@/lib/competitor-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<Platform, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  GEMINI: "Gemini",
  COPILOT: "Copilot",
  GROK: "Grok",
  GOOGLE_AI_OVERVIEWS: "Google AIO",
};

const PLAN_COMPETITOR_LIMITS: Record<Plan, number> = {
  FREE: 2,
  STARTER: 3,
  GROWTH: 5,
  ENTERPRISE: 10,
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

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: {
        competitors: true,
        prompts: { orderBy: { createdAt: "asc" } },
        user: { select: { plan: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const planLimit = PLAN_COMPETITOR_LIMITS[project.user.plan];
    const competitorNames = project.competitors.map((c) => c.brandName);
    const allBrands = [project.brandName, ...competitorNames];

    // Fetch all mentions for this project
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [allMentions, recentMentions, citations] = await Promise.all([
      prisma.mention.findMany({
        where: { projectId },
        select: {
          promptId: true,
          platform: true,
          brandMentioned: true,
          competitorsMentioned: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.mention.findMany({
        where: { projectId, createdAt: { gte: thirtyDaysAgo } },
        select: {
          platform: true,
          brandMentioned: true,
          competitorsMentioned: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.citation.findMany({
        where: { projectId },
        select: { domain: true, isOwned: true },
      }),
    ]);

    // ── 1. Share of Voice by platform ────────────────────────────────────
    // For each platform and brand, count how many mentions include that brand.
    const platBrandMap = new Map<string, Map<string, { count: number; total: number }>>();

    for (const m of allMentions) {
      const pl = PLATFORM_LABELS[m.platform];
      if (!platBrandMap.has(pl)) platBrandMap.set(pl, new Map());
      const bm = platBrandMap.get(pl)!;

      // Increment total for all brands
      for (const brand of allBrands) {
        const cur = bm.get(brand) ?? { count: 0, total: 0 };
        cur.total++;
        bm.set(brand, cur);
      }
      // Increment brand mentions
      if (m.brandMentioned) {
        const cur = bm.get(project.brandName) ?? { count: 0, total: 0 };
        cur.count++;
        bm.set(project.brandName, cur);
      }
      for (const comp of m.competitorsMentioned) {
        if (competitorNames.includes(comp)) {
          const cur = bm.get(comp) ?? { count: 0, total: 0 };
          cur.count++;
          bm.set(comp, cur);
        }
      }
    }

    const sovByPlatform: SoVPlatformBar[] = [];
    for (const [pl, bm] of platBrandMap.entries()) {
      // Get max total across brands for this platform (they should be equal)
      const maxTotal = Math.max(...[...bm.values()].map((v) => v.total), 1);

      // Calculate total mentioned slots to derive "Other"
      let mentionedSum = 0;
      const bar: SoVPlatformBar = { platform: pl };
      for (const brand of allBrands) {
        const v = bm.get(brand) ?? { count: 0, total: maxTotal };
        const rate = Math.round((v.count / Math.max(v.total, 1)) * 100);
        bar[brand] = rate;
        mentionedSum += v.count;
      }
      // "Other" = responses where neither brand nor competitors were mentioned
      const otherRate = Math.max(0, Math.round(((maxTotal - mentionedSum) / maxTotal) * 100));
      bar["Other"] = otherRate;
      sovByPlatform.push(bar);
    }

    // ── 2. Head-to-head prompt table ─────────────────────────────────────
    // For each prompt, find the most recent mention per platform, aggregate
    // whether the brand / each competitor was mentioned.
    const h2hRows: H2HPromptRow[] = [];
    for (const prompt of project.prompts) {
      const promptMentions = allMentions.filter((m) => m.promptId === prompt.id);
      // Aggregate: was brand mentioned in any response for this prompt?
      const brandAny = promptMentions.some((m) => m.brandMentioned);
      const results: Record<string, boolean> = { [project.brandName]: brandAny };
      for (const comp of competitorNames) {
        results[comp] = promptMentions.some((m) => m.competitorsMentioned.includes(comp));
      }

      const youWin = brandAny;
      const compWins = competitorNames.some((c) => results[c]);
      let outcome: H2HPromptRow["outcome"] = "empty";
      if (promptMentions.length === 0) outcome = "empty";
      else if (youWin && !compWins) outcome = "win";
      else if (!youWin && compWins) outcome = "loss";
      else outcome = "tie";

      h2hRows.push({
        promptId: prompt.id,
        promptText: prompt.text,
        category: prompt.category,
        results,
        outcome,
      });
    }

    // Win rates per brand
    const totalScanned = h2hRows.filter((r) => r.outcome !== "empty").length;
    const winRates: Record<string, number> = {};
    for (const brand of allBrands) {
      const wins = h2hRows.filter(
        (r) => r.outcome !== "empty" && r.results[brand] === true
      ).length;
      winRates[brand] = totalScanned > 0 ? Math.round((wins / totalScanned) * 100) : 0;
    }
    const h2hSummary: H2HSummary = { winRates };

    // ── 3. Trend data (last 30 days) ─────────────────────────────────────
    const dayBrandMap = new Map<string, Map<string, { count: number; total: number }>>();
    for (const m of recentMentions) {
      const day = m.createdAt.toISOString().slice(0, 10);
      if (!dayBrandMap.has(day)) dayBrandMap.set(day, new Map());
      const bm = dayBrandMap.get(day)!;
      for (const brand of allBrands) {
        const cur = bm.get(brand) ?? { count: 0, total: 0 };
        cur.total++;
        bm.set(brand, cur);
      }
      if (m.brandMentioned) {
        const cur = bm.get(project.brandName) ?? { count: 0, total: 0 };
        cur.count++;
        bm.set(project.brandName, cur);
      }
      for (const comp of m.competitorsMentioned) {
        if (competitorNames.includes(comp)) {
          const cur = bm.get(comp) ?? { count: 0, total: 0 };
          cur.count++;
          bm.set(comp, cur);
        }
      }
    }

    const trendData: TrendPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);
      const bm = dayBrandMap.get(day);
      const point: TrendPoint = { date: day };
      for (const brand of allBrands) {
        const v = bm?.get(brand);
        point[brand] = v && v.total > 0 ? Math.round((v.count / v.total) * 100) : 0;
      }
      trendData.push(point);
    }

    // ── 4. Prompt gap analysis ────────────────────────────────────────────
    const gapRows: GapRow[] = h2hRows
      .filter((r) => r.outcome === "loss")
      .map((r) => ({
        promptId: r.promptId,
        promptText: r.promptText,
        competitorsPresent: competitorNames.filter((c) => r.results[c] === true),
      }));

    // ── 5. Citation sources comparison ────────────────────────────────────
    // Your domains from Citation table
    const ownedDomainMap = new Map<string, number>();
    for (const c of citations.filter((c) => c.isOwned)) {
      ownedDomainMap.set(c.domain, (ownedDomainMap.get(c.domain) ?? 0) + 1);
    }
    const thirdDomainMap = new Map<string, number>();
    for (const c of citations.filter((c) => !c.isOwned)) {
      thirdDomainMap.set(c.domain, (thirdDomainMap.get(c.domain) ?? 0) + 1);
    }

    const citationSources: CitationSourceRow[] = [
      {
        brand: project.brandName,
        domains: [...thirdDomainMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([domain, count]) => ({ domain, count })),
      },
    ];
    // Competitors: we don't have separate citation rows per competitor, so we
    // approximate by looking at competitorsMentioned in mentions and matching
    // citations from the same mention. For now surface a placeholder per comp
    // that shows "—" until enough data accumulates.
    for (const comp of project.competitors) {
      citationSources.push({
        brand: comp.brandName,
        domains: [], // populated once competitor-specific citation data is available
      });
    }

    const data: CompetitorData = {
      projectId,
      brandName: project.brandName,
      competitors: project.competitors.map((c) => ({
        id: c.id,
        brandName: c.brandName,
        websiteUrl: c.websiteUrl,
      })),
      planLimit,
      sovByPlatform,
      allBrands,
      h2hRows,
      h2hSummary,
      trendData,
      gapRows,
      citationSources,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Competitors API error:", error);
    return NextResponse.json({ error: "Failed to load competitor data." }, { status: 500 });
  }
}
