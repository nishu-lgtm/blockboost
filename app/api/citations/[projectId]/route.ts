import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OwnedPageRow {
  url: string;
  domain: string;
  count: number;
  platforms: string[];
}

export interface ThirdPartyRow {
  domain: string;
  count: number;
  category: "authoritative" | "review" | "social" | "news" | "other";
  platforms: string[];
}

export interface TimelinePoint {
  date: string; // YYYY-MM-DD
  owned: number;
  thirdParty: number;
}

export interface PlatformDomainRow {
  platform: string;
  topDomains: Array<{ domain: string; count: number }>;
}

export interface HallucinationAlert {
  platform: string;
  claim: string;
  severity: "high" | "medium" | "low";
}

export interface CitationSummary {
  total: number;
  owned: number;
  thirdParty: number;
  mostCitedPlatform: string | null;
  ownedRate: number; // 0-100
}

export interface CitationsData {
  projectId: string;
  brandName: string;
  days: number;
  summary: CitationSummary;
  ownedPages: OwnedPageRow[];
  thirdPartyDomains: ThirdPartyRow[];
  timeline: TimelinePoint[];
  platformPreferences: PlatformDomainRow[];
  hallucinationAlerts: HallucinationAlert[];
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

const AUTHORITATIVE_DOMAINS = new Set([
  "wikipedia.org", "reuters.com", "bbc.com", "nytimes.com", "bloomberg.com",
  "wsj.com", "theguardian.com", "techcrunch.com", "forbes.com", "wired.com",
  "harvard.edu", "mit.edu", "gov", "cdc.gov", "nih.gov",
]);

const REVIEW_DOMAINS = new Set([
  "g2.com", "capterra.com", "trustpilot.com", "getapp.com", "producthunt.com",
  "softwareadvice.com", "crozdesk.com", "gartner.com", "sitejabber.com",
]);

const SOCIAL_DOMAINS = new Set([
  "reddit.com", "twitter.com", "x.com", "linkedin.com", "facebook.com",
  "quora.com", "stackoverflow.com", "dev.to", "medium.com", "substack.com",
]);

const NEWS_DOMAINS = new Set([
  "techcrunch.com", "venturebeat.com", "theverge.com", "engadget.com",
  "zdnet.com", "infoq.com", "hackernews.com", "ycombinator.com",
]);

function classifyDomain(domain: string): ThirdPartyRow["category"] {
  const d = domain.toLowerCase();
  if ([...AUTHORITATIVE_DOMAINS].some((a) => d.includes(a))) return "authoritative";
  if ([...REVIEW_DOMAINS].some((r) => d.includes(r))) return "review";
  if ([...SOCIAL_DOMAINS].some((s) => d.includes(s))) return "social";
  if ([...NEWS_DOMAINS].some((n) => d.includes(n))) return "news";
  return "other";
}

// ---------------------------------------------------------------------------
// Hallucination check via OpenAI
// ---------------------------------------------------------------------------

async function checkHallucinations(
  brandName: string,
  responseTexts: string[],
  platforms: string[]
): Promise<HallucinationAlert[]> {
  const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

  if (!openai || responseTexts.length === 0) return [];

  // Sample up to 5 responses to avoid token/cost overrun
  const samples = responseTexts.slice(0, 5);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a fact-checking assistant. Given AI-generated response texts about a brand, identify any claims that seem suspicious, potentially incorrect, or hallucinated. Focus on concrete factual claims (pricing, founding year, headcount, features, locations). Return JSON: { "alerts": [{ "claim": string, "severity": "high"|"medium"|"low" }] }. Return at most 3 alerts. If no suspicious claims, return { "alerts": [] }.`,
        },
        {
          role: "user",
          content: `Brand: ${brandName}\n\nAI Response samples:\n${samples.map((t, i) => `[${i + 1}] ${t.slice(0, 400)}`).join("\n\n")}`,
        },
      ],
      max_tokens: 300,
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      alerts?: Array<{ claim: string; severity: string }>;
    };

    return (parsed.alerts ?? []).slice(0, 3).map((a, i) => ({
      platform: platforms[i % platforms.length] ?? "Unknown",
      claim: a.claim,
      severity: (["high", "medium", "low"].includes(a.severity)
        ? a.severity
        : "medium") as HallucinationAlert["severity"],
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const url = new URL(req.url);
    const days = Math.min(
      90,
      Math.max(7, parseInt(url.searchParams.get("days") ?? "30", 10))
    );

    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      select: { id: true, brandName: true, websiteUrl: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Fetch citations in date range
    const citations = await prisma.citation.findMany({
      where: { projectId, createdAt: { gte: since } },
      select: {
        url: true,
        domain: true,
        isOwned: true,
        platform: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // ── Summary ─────────────────────────────────────────────────────────
    const total = citations.length;
    const ownedCount = citations.filter((c) => c.isOwned).length;
    const thirdPartyCount = total - ownedCount;
    const ownedRate = total > 0 ? Math.round((ownedCount / total) * 100) : 0;

    const platformCounts = new Map<string, number>();
    for (const c of citations) {
      const pl = PLATFORM_LABELS[c.platform];
      platformCounts.set(pl, (platformCounts.get(pl) ?? 0) + 1);
    }
    let mostCitedPlatform: string | null = null;
    let maxCount = 0;
    for (const [pl, count] of platformCounts) {
      if (count > maxCount) { maxCount = count; mostCitedPlatform = pl; }
    }

    const summary: CitationSummary = { total, owned: ownedCount, thirdParty: thirdPartyCount, mostCitedPlatform, ownedRate };

    // ── Owned pages ──────────────────────────────────────────────────────
    const ownedMap = new Map<string, { count: number; platforms: Set<string> }>();
    for (const c of citations.filter((c) => c.isOwned)) {
      const cur = ownedMap.get(c.url) ?? { count: 0, platforms: new Set() };
      cur.count++;
      cur.platforms.add(PLATFORM_LABELS[c.platform]);
      ownedMap.set(c.url, cur);
    }
    const ownedPages: OwnedPageRow[] = [...ownedMap.entries()]
      .map(([url, v]) => ({ url, domain: new URL(url).hostname, count: v.count, platforms: [...v.platforms] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── Third-party domains ──────────────────────────────────────────────
    const thirdMap = new Map<string, { count: number; platforms: Set<string> }>();
    for (const c of citations.filter((c) => !c.isOwned)) {
      const cur = thirdMap.get(c.domain) ?? { count: 0, platforms: new Set() };
      cur.count++;
      cur.platforms.add(PLATFORM_LABELS[c.platform]);
      thirdMap.set(c.domain, cur);
    }
    const thirdPartyDomains: ThirdPartyRow[] = [...thirdMap.entries()]
      .map(([domain, v]) => ({ domain, count: v.count, category: classifyDomain(domain), platforms: [...v.platforms] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── Timeline ─────────────────────────────────────────────────────────
    const timelineMap = new Map<string, { owned: number; thirdParty: number }>();
    for (const c of citations) {
      const day = c.createdAt.toISOString().slice(0, 10);
      const cur = timelineMap.get(day) ?? { owned: 0, thirdParty: 0 };
      if (c.isOwned) cur.owned++;
      else cur.thirdParty++;
      timelineMap.set(day, cur);
    }
    const timeline: TimelinePoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);
      const v = timelineMap.get(day) ?? { owned: 0, thirdParty: 0 };
      timeline.push({ date: day, ...v });
    }

    // ── Platform preferences ─────────────────────────────────────────────
    const platDomainMap = new Map<string, Map<string, number>>();
    for (const c of citations) {
      const pl = PLATFORM_LABELS[c.platform];
      if (!platDomainMap.has(pl)) platDomainMap.set(pl, new Map());
      const dm = platDomainMap.get(pl)!;
      dm.set(c.domain, (dm.get(c.domain) ?? 0) + 1);
    }
    const platformPreferences: PlatformDomainRow[] = [...platDomainMap.entries()]
      .map(([platform, domMap]) => ({
        platform,
        topDomains: [...domMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([domain, count]) => ({ domain, count })),
      }))
      .sort((a, b) => a.platform.localeCompare(b.platform));

    // ── Hallucination check ──────────────────────────────────────────────
    // Sample size is bounded by HALLUCINATION_SAMPLE_SIZE to control OpenAI cost.
    // Default 20; override via env. Also count total to surface "more pending" hint.
    const SAMPLE_SIZE = Math.max(
      1,
      Math.min(50, Number(process.env.HALLUCINATION_SAMPLE_SIZE) || 20)
    );

    const [mentionTexts, brandedTotal] = await Promise.all([
      prisma.mention.findMany({
        where: { projectId, brandMentioned: true, createdAt: { gte: since } },
        select: { responseText: true, platform: true },
        take: SAMPLE_SIZE,
        orderBy: { createdAt: "desc" },
      }),
      prisma.mention.count({
        where: { projectId, brandMentioned: true, createdAt: { gte: since } },
      }),
    ]);

    if (brandedTotal > SAMPLE_SIZE) {
      console.log(
        `[citations] Hallucination check sampled ${SAMPLE_SIZE}/${brandedTotal} brand mentions for project ${projectId}`
      );
    }

    const hallucinationAlerts = await checkHallucinations(
      project.brandName,
      mentionTexts.map((m) => m.responseText),
      mentionTexts.map((m) => PLATFORM_LABELS[m.platform])
    );

    const data: CitationsData = {
      projectId,
      brandName: project.brandName,
      days,
      summary,
      ownedPages,
      thirdPartyDomains,
      timeline,
      platformPreferences,
      hallucinationAlerts,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Citations API error:", error);
    return NextResponse.json({ error: "Failed to load citation data." }, { status: 500 });
  }
}
