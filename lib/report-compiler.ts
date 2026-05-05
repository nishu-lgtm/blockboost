/**
 * Report Compiler — fetches and structures all data needed for a PDF report.
 * Called by /api/reports/generate before PDF rendering.
 */

import { prisma } from "@/lib/prisma";
import { Platform, Sentiment } from "@prisma/client";
import OpenAI from "openai";
import { format, differenceInDays } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportPlatformStat {
  platform: string;
  mentionRate: number;
  mentionRateChange: number;
  citationsFound: number;
  sentiment: { positive: number; neutral: number; negative: number };
}

export interface ReportWin {
  prompt: string;
  mentionRate: number;
  platforms: string[];
}

export interface ReportGap {
  prompt: string;
  competitorsAppearing: string[];
  priority: "high" | "medium";
  gscImpressions: number | null;
}

export interface ReportCompetitor {
  brandName: string;
  mentionRate: number;
  mentionRateChange: number;
  topPlatforms: string[];
}

export interface ReportActionItem {
  priority: 1 | 2 | 3 | 4 | 5;
  action: string;
  impact: "High" | "Medium" | "Low";
  effort: "High" | "Medium" | "Low";
  detail: string;
}

export interface ReportData {
  project: {
    name: string;
    brandName: string;
    websiteUrl: string;
  };
  generatedAt: string;
  period: { start: string; end: string; label: string };

  executiveSummary: {
    overallMentionRate: number;
    mentionRateChange: number;
    totalPromptsTracked: number;
    platformsTracked: string[];
    topPlatform: string;
    worstPlatform: string;
    totalCitationsFound: number;
    ownedCitationRate: number;
    shareOfVoice: number;
    shareOfVoiceChange: number;
    narrative: string;
  };

  platformBreakdown: ReportPlatformStat[];
  topWins: ReportWin[];
  topGaps: ReportGap[];
  competitorComparison: ReportCompetitor[];

  citationAnalysis: {
    topOwnedPages: Array<{ url: string; citationCount: number; platforms: string[] }>;
    topThirdPartySources: Array<{ domain: string; citationCount: number }>;
    newCitationsThisPeriod: number;
    lostCitationsThisPeriod: number;
  };

  auditScore: number | null;
  auditScoreChange: number | null;
  actionRoadmap: ReportActionItem[];
  contentBriefsGenerated: number;
  contentBriefsPending: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<Platform, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  GEMINI: "Gemini",
  COPILOT: "Copilot",
  GROK: "Grok",
  GOOGLE_AI_OVERVIEWS: "Google AIO",
};

function safeDivPct(num: number, denom: number) {
  return denom === 0 ? 0 : Math.round((num / denom) * 100);
}

function periodLabel(start: Date, end: Date): string {
  const days = differenceInDays(end, start);
  if (days <= 8) return `Week of ${format(start, "MMM d, yyyy")}`;
  if (days <= 32) return format(start, "MMMM yyyy");
  if (days <= 95) return `Q${Math.ceil((start.getMonth() + 1) / 3)} ${format(start, "yyyy")}`;
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

// ---------------------------------------------------------------------------
// OpenAI helpers
// ---------------------------------------------------------------------------

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

async function generateNarrative(
  brandName: string,
  period: string,
  overallRate: number,
  change: number,
  topPlatform: string,
  topRate: number,
  worstPlatform: string,
  worstRate: number,
  shareOfVoice: number,
): Promise<string> {
  const openai = getOpenAI();
  if (!openai) {
    const dir = change >= 0 ? "up" : "down";
    const abs = Math.abs(change);
    return `In ${period}, ${brandName} appeared in ${overallRate}% of tracked AI queries, ${dir} ${abs} percentage points from the previous period. ${topPlatform} remains the strongest channel at ${topRate}%, while ${worstPlatform} at ${worstRate}% presents the biggest opportunity for improvement. With a share of voice of ${shareOfVoice}% against tracked competitors, there is clear room to grow AI visibility through targeted content and schema improvements.`;
  }
  try {
    const prompt = `Write a 3-sentence executive narrative for an AI visibility report.
Brand: ${brandName}
Period: ${period}
Overall mention rate: ${overallRate}% (${change >= 0 ? "+" : ""}${change}pp vs last period)
Best platform: ${topPlatform} at ${topRate}%
Worst platform: ${worstPlatform} at ${worstRate}%
Share of voice vs competitors: ${shareOfVoice}%

Be specific, professional, and concise. Start with "In ${period}," and mention specific numbers.`;
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 160,
      temperature: 0.4,
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return `In ${period}, ${brandName} achieved a ${overallRate}% overall mention rate across tracked AI platforms, representing a ${change >= 0 ? "+" : ""}${change}pp change versus the prior period.`;
  }
}

async function generateActionRoadmap(
  brandName: string,
  topGaps: ReportGap[],
  platformBreakdown: ReportPlatformStat[],
  competitorComparison: ReportCompetitor[],
  auditScore: number | null,
): Promise<ReportActionItem[]> {
  const openai = getOpenAI();

  const fallback: ReportActionItem[] = [
    {
      priority: 1,
      action: "Optimise content for top gap prompts",
      impact: "High",
      effort: "Medium",
      detail: `Create dedicated FAQ pages for the ${topGaps.length} prompts where ${brandName} has zero visibility. Structure content to directly answer the query in the opening paragraph.`,
    },
    {
      priority: 2,
      action: "Add FAQPage schema to key landing pages",
      impact: "High",
      effort: "Low",
      detail: "Implement JSON-LD FAQPage schema on your top 5 landing pages. AI models preferentially cite pages with structured data that clearly signals content type.",
    },
    {
      priority: 3,
      action: `Improve ${platformBreakdown.at(-1)?.platform ?? "weakest platform"} performance`,
      impact: "Medium",
      effort: "Medium",
      detail: `Focus content format and length on ${brandName}'s weakest platform. Research how competitor content differs on that platform and replicate their structure.`,
    },
    {
      priority: 4,
      action: "Build authoritative third-party citations",
      impact: "Medium",
      effort: "High",
      detail: "Reach out to review sites (G2, Capterra, Trustpilot) to ensure your profile is complete and up-to-date. AI models frequently defer to review site ratings when recommending software.",
    },
    {
      priority: 5,
      action: "Publish weekly original research or data",
      impact: "Low",
      effort: "High",
      detail: "Original statistics and proprietary data are frequently cited by AI models. Publish one piece of original research per month to build topical authority.",
    },
  ];

  if (!openai) return fallback;

  try {
    const context = `Brand: ${brandName}
Top gaps (prompts with 0% visibility): ${topGaps.slice(0, 3).map(g => `"${g.prompt}" (competitors: ${g.competitorsAppearing.join(", ") || "none"})`).join("; ")}
Weakest platform: ${platformBreakdown.at(-1)?.platform ?? "unknown"} at ${platformBreakdown.at(-1)?.mentionRate ?? 0}%
AEO audit score: ${auditScore ?? "not run"}
Competitor with highest share: ${competitorComparison[0]?.brandName ?? "none"} at ${competitorComparison[0]?.mentionRate ?? 0}%`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Generate exactly 5 prioritized AEO action items for a brand based on their performance data. Return JSON: { "items": [ { "priority": 1-5, "action": "short title under 8 words", "impact": "High|Medium|Low", "effort": "High|Medium|Low", "detail": "2 sentences explaining what to do and why" } ] }. Be specific and actionable.`,
        },
        { role: "user", content: context },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as {
      items?: Array<{
        priority: number;
        action: string;
        impact: string;
        effort: string;
        detail: string;
      }>;
    };
    if (parsed.items && parsed.items.length === 5) {
      return parsed.items.map(item => ({
        priority: Math.max(1, Math.min(5, item.priority)) as 1 | 2 | 3 | 4 | 5,
        action: item.action,
        impact: (["High", "Medium", "Low"].includes(item.impact) ? item.impact : "Medium") as "High" | "Medium" | "Low",
        effort: (["High", "Medium", "Low"].includes(item.effort) ? item.effort : "Medium") as "High" | "Medium" | "Low",
        detail: item.detail,
      }));
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Main compiler
// ---------------------------------------------------------------------------

export async function compileReportData(
  projectId: string,
  startDate: Date,
  endDate: Date,
): Promise<ReportData> {
  const prevStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
  const prevEnd = startDate;

  // ── 1. Project + prompt info ──────────────────────────────────────────────
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      prompts: {
        select: { id: true, text: true, gscImpressions: true },
      },
      competitors: { select: { brandName: true } },
    },
  });
  if (!project) throw new Error(`Project ${projectId} not found`);

  const promptMap = new Map(project.prompts.map(p => [p.id, p]));
  const competitorNames = project.competitors.map(c => c.brandName);

  // ── 2. Mentions (current and previous periods) ────────────────────────────
  const [currentMentions, prevMentions] = await Promise.all([
    prisma.mention.findMany({
      where: { projectId, createdAt: { gte: startDate, lte: endDate } },
      select: {
        promptId: true, platform: true, brandMentioned: true,
        competitorsMentioned: true, sentiment: true,
      },
    }),
    prisma.mention.findMany({
      where: { projectId, createdAt: { gte: prevStart, lt: prevEnd } },
      select: { promptId: true, platform: true, brandMentioned: true, competitorsMentioned: true },
    }),
  ]);

  // ── 3. Overall rates ──────────────────────────────────────────────────────
  const overallMentionRate = safeDivPct(
    currentMentions.filter(m => m.brandMentioned).length,
    currentMentions.length,
  );
  const prevOverallRate = safeDivPct(
    prevMentions.filter(m => m.brandMentioned).length,
    prevMentions.length,
  );
  const mentionRateChange = overallMentionRate - prevOverallRate;

  // ── 4. Per-platform breakdown ─────────────────────────────────────────────
  const platformMap = new Map<Platform, {
    total: number; mentioned: number;
    prevTotal: number; prevMentioned: number;
    citations: number;
    sentPos: number; sentNeu: number; sentNeg: number;
  }>();

  for (const m of currentMentions) {
    const cur = platformMap.get(m.platform) ?? {
      total: 0, mentioned: 0, prevTotal: 0, prevMentioned: 0,
      citations: 0, sentPos: 0, sentNeu: 0, sentNeg: 0,
    };
    cur.total++;
    if (m.brandMentioned) {
      cur.mentioned++;
      if (m.sentiment === Sentiment.POSITIVE) cur.sentPos++;
      else if (m.sentiment === Sentiment.NEGATIVE) cur.sentNeg++;
      else cur.sentNeu++;
    }
    platformMap.set(m.platform, cur);
  }
  for (const m of prevMentions) {
    const cur = platformMap.get(m.platform) ?? {
      total: 0, mentioned: 0, prevTotal: 0, prevMentioned: 0,
      citations: 0, sentPos: 0, sentNeu: 0, sentNeg: 0,
    };
    cur.prevTotal++;
    if (m.brandMentioned) cur.prevMentioned++;
    platformMap.set(m.platform, cur);
  }

  const platformBreakdown: ReportPlatformStat[] = [...platformMap.entries()]
    .map(([platform, s]) => {
      const rate = safeDivPct(s.mentioned, s.total);
      const prevRate = safeDivPct(s.prevMentioned, s.prevTotal);
      const total = s.sentPos + s.sentNeu + s.sentNeg;
      return {
        platform: PLATFORM_LABELS[platform],
        mentionRate: rate,
        mentionRateChange: rate - prevRate,
        citationsFound: s.citations,
        sentiment: {
          positive: safeDivPct(s.sentPos, total),
          neutral: safeDivPct(s.sentNeu, total),
          negative: safeDivPct(s.sentNeg, total),
        },
      };
    })
    .sort((a, b) => b.mentionRate - a.mentionRate);

  const topPlatform = platformBreakdown[0]?.platform ?? "N/A";
  const worstPlatform = platformBreakdown.at(-1)?.platform ?? "N/A";
  const platformsTracked = platformBreakdown.map(p => p.platform);

  // ── 5. Per-prompt: wins and gaps ──────────────────────────────────────────
  const promptStats = new Map<string, {
    mentioned: number; total: number;
    platforms: Set<string>;
    competitors: Set<string>;
  }>();

  for (const m of currentMentions) {
    const s = promptStats.get(m.promptId) ?? {
      mentioned: 0, total: 0,
      platforms: new Set<string>(),
      competitors: new Set<string>(),
    };
    s.total++;
    if (m.brandMentioned) { s.mentioned++; s.platforms.add(PLATFORM_LABELS[m.platform]); }
    for (const c of m.competitorsMentioned) {
      if (competitorNames.some(n => n.toLowerCase() === c.toLowerCase())) {
        s.competitors.add(c);
      }
    }
    promptStats.set(m.promptId, s);
  }

  const topWins: ReportWin[] = [...promptStats.entries()]
    .filter(([, s]) => s.mentioned > 0)
    .map(([id, s]) => ({
      prompt: promptMap.get(id)?.text ?? "Unknown prompt",
      mentionRate: safeDivPct(s.mentioned, s.total),
      platforms: [...s.platforms],
    }))
    .sort((a, b) => b.mentionRate - a.mentionRate)
    .slice(0, 5);

  const topGaps: ReportGap[] = [...promptStats.entries()]
    .filter(([, s]) => s.mentioned === 0)
    .map(([id, s]) => {
      const prompt = promptMap.get(id);
      return {
        prompt: prompt?.text ?? "Unknown prompt",
        competitorsAppearing: [...s.competitors],
        priority: (s.competitors.size >= 2 ? "high" : "medium") as "high" | "medium",
        gscImpressions: prompt?.gscImpressions ?? null,
      };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
      return (b.gscImpressions ?? 0) - (a.gscImpressions ?? 0);
    })
    .slice(0, 5);

  // ── 6. Competitor comparison ──────────────────────────────────────────────
  const compCurrentMap = new Map<string, { count: number; platforms: Set<string> }>();
  const compPrevMap = new Map<string, number>();

  for (const m of currentMentions) {
    for (const c of m.competitorsMentioned) {
      const name = competitorNames.find(n => n.toLowerCase() === c.toLowerCase()) ?? c;
      const cur = compCurrentMap.get(name) ?? { count: 0, platforms: new Set<string>() };
      cur.count++;
      cur.platforms.add(PLATFORM_LABELS[m.platform]);
      compCurrentMap.set(name, cur);
    }
  }
  for (const m of prevMentions) {
    for (const c of m.competitorsMentioned) {
      const name = competitorNames.find(n => n.toLowerCase() === c.toLowerCase()) ?? c;
      compPrevMap.set(name, (compPrevMap.get(name) ?? 0) + 1);
    }
  }

  const competitorComparison: ReportCompetitor[] = competitorNames
    .map(name => {
      const cur = compCurrentMap.get(name);
      const currentRate = safeDivPct(cur?.count ?? 0, currentMentions.length);
      const prevRate = safeDivPct(compPrevMap.get(name) ?? 0, prevMentions.length);
      return {
        brandName: name,
        mentionRate: currentRate,
        mentionRateChange: currentRate - prevRate,
        topPlatforms: cur ? [...cur.platforms].slice(0, 3) : [],
      };
    })
    .sort((a, b) => b.mentionRate - a.mentionRate);

  // Share of voice = brand mentions / (brand + all competitor mentions) * 100
  const brandCount = currentMentions.filter(m => m.brandMentioned).length;
  const allCompCount = [...compCurrentMap.values()].reduce((s, v) => s + v.count, 0);
  const shareOfVoice = safeDivPct(brandCount, brandCount + allCompCount);
  const prevBrandCount = prevMentions.filter(m => m.brandMentioned).length;
  const prevAllCompCount = [...compPrevMap.values()].reduce((s, v) => s + v, 0);
  const prevShareOfVoice = safeDivPct(prevBrandCount, prevBrandCount + prevAllCompCount);
  const shareOfVoiceChange = shareOfVoice - prevShareOfVoice;

  // ── 7. Citations ──────────────────────────────────────────────────────────
  const [currentCitations, prevCitations] = await Promise.all([
    prisma.citation.findMany({
      where: { projectId, createdAt: { gte: startDate, lte: endDate } },
      select: { url: true, domain: true, isOwned: true, platform: true },
    }),
    prisma.citation.findMany({
      where: { projectId, createdAt: { gte: prevStart, lt: prevEnd } },
      select: { domain: true },
    }),
  ]);

  // Add citation counts to platform breakdown
  for (const c of currentCitations) {
    const pb = platformBreakdown.find(p => p.platform === PLATFORM_LABELS[c.platform]);
    if (pb) pb.citationsFound++;
  }

  const totalCitationsFound = currentCitations.length;
  const ownedCitations = currentCitations.filter(c => c.isOwned).length;
  const ownedCitationRate = safeDivPct(ownedCitations, totalCitationsFound);

  // New/lost citations (by domain)
  const prevDomainSet = new Set(prevCitations.map(c => c.domain));
  const currentDomainSet = new Set(currentCitations.map(c => c.domain));
  const newCitationsThisPeriod = [...currentDomainSet].filter(d => !prevDomainSet.has(d)).length;
  const lostCitationsThisPeriod = [...prevDomainSet].filter(d => !currentDomainSet.has(d)).length;

  // Top owned pages
  const ownedMap = new Map<string, { count: number; platforms: Set<string> }>();
  for (const c of currentCitations.filter(c => c.isOwned)) {
    const cur = ownedMap.get(c.url) ?? { count: 0, platforms: new Set<string>() };
    cur.count++;
    cur.platforms.add(PLATFORM_LABELS[c.platform]);
    ownedMap.set(c.url, cur);
  }
  const topOwnedPages = [...ownedMap.entries()]
    .map(([url, v]) => ({ url, citationCount: v.count, platforms: [...v.platforms] }))
    .sort((a, b) => b.citationCount - a.citationCount)
    .slice(0, 8);

  // Top third-party sources
  const thirdMap = new Map<string, number>();
  for (const c of currentCitations.filter(c => !c.isOwned)) {
    thirdMap.set(c.domain, (thirdMap.get(c.domain) ?? 0) + 1);
  }
  const topThirdPartySources = [...thirdMap.entries()]
    .map(([domain, citationCount]) => ({ domain, citationCount }))
    .sort((a, b) => b.citationCount - a.citationCount)
    .slice(0, 8);

  // ── 8. Audit scores ───────────────────────────────────────────────────────
  const [latestAudit, prevAudit] = await Promise.all([
    prisma.auditReport.findFirst({
      where: { projectId, createdAt: { lte: endDate } },
      orderBy: { createdAt: "desc" },
      select: { overallScore: true },
    }),
    prisma.auditReport.findFirst({
      where: { projectId, createdAt: { lte: prevEnd, gte: prevStart } },
      orderBy: { createdAt: "desc" },
      select: { overallScore: true },
    }),
  ]);
  const auditScore = latestAudit?.overallScore ?? null;
  const auditScoreChange = auditScore !== null && prevAudit
    ? auditScore - prevAudit.overallScore
    : null;

  // ── 9. Content briefs ─────────────────────────────────────────────────────
  const briefs = await prisma.contentBrief.findMany({
    where: { projectId },
    select: { status: true },
  });
  const contentBriefsGenerated = briefs.filter(b => b.status === "GENERATED" || b.status === "PUBLISHED").length;
  const contentBriefsPending = briefs.filter(b => b.status === "PENDING").length;

  // ── 10. OpenAI-generated content ──────────────────────────────────────────
  const label = periodLabel(startDate, endDate);

  const [narrative, actionRoadmap] = await Promise.all([
    generateNarrative(
      project.brandName, label, overallMentionRate, mentionRateChange,
      topPlatform, platformBreakdown[0]?.mentionRate ?? 0,
      worstPlatform, platformBreakdown.at(-1)?.mentionRate ?? 0,
      shareOfVoice,
    ),
    generateActionRoadmap(
      project.brandName, topGaps, platformBreakdown, competitorComparison, auditScore,
    ),
  ]);

  // ── 11. Assemble ──────────────────────────────────────────────────────────
  return {
    project: { name: project.name, brandName: project.brandName, websiteUrl: project.websiteUrl },
    generatedAt: new Date().toISOString(),
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      label,
    },
    executiveSummary: {
      overallMentionRate,
      mentionRateChange,
      totalPromptsTracked: project.prompts.length,
      platformsTracked,
      topPlatform,
      worstPlatform,
      totalCitationsFound,
      ownedCitationRate,
      shareOfVoice,
      shareOfVoiceChange,
      narrative,
    },
    platformBreakdown,
    topWins,
    topGaps,
    competitorComparison,
    citationAnalysis: {
      topOwnedPages,
      topThirdPartySources,
      newCitationsThisPeriod,
      lostCitationsThisPeriod,
    },
    auditScore,
    auditScoreChange,
    actionRoadmap,
    contentBriefsGenerated,
    contentBriefsPending,
  };
}
