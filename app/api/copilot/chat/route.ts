import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { z } from "zod";

const bodySchema = z.object({
  messages: z.array(
    z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
  ),
  projectId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<string, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  GEMINI: "Gemini",
  COPILOT: "Copilot",
  GROK: "Grok",
  GOOGLE_AI_OVERVIEWS: "Google AIO",
};

async function buildContext(projectId: string, userId: string) {
  const [project, mentions, citations, latestAudit, briefs] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        competitors: { select: { brandName: true } },
        prompts: { select: { id: true, text: true, category: true } },
      },
    }),
    prisma.mention.findMany({
      where: { projectId },
      select: {
        promptId: true,
        platform: true,
        brandMentioned: true,
        competitorsMentioned: true,
        sentiment: true,
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.citation.findMany({
      where: { projectId },
      select: { isOwned: true, platform: true },
    }),
    prisma.auditReport.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        url: true,
        overallScore: true,
        crawlabilityScore: true,
        schemaScore: true,
        contentScore: true,
        authorityScore: true,
        recommendations: true,
        createdAt: true,
      },
    }),
    prisma.contentBrief.findMany({
      where: { projectId },
      select: { status: true },
    }),
  ]);

  if (!project) return null;

  const competitorNames = project.competitors.map((c) => c.brandName);
  const promptMap = new Map(project.prompts.map((p) => [p.id, p]));

  // Platform mention rates
  const byPlatform: Record<string, { mentioned: number; total: number }> = {};
  for (const m of mentions) {
    const pl = PLATFORM_LABELS[m.platform] ?? m.platform;
    if (!byPlatform[pl]) byPlatform[pl] = { mentioned: 0, total: 0 };
    byPlatform[pl].total++;
    if (m.brandMentioned) byPlatform[pl].mentioned++;
  }

  const platformRates = Object.entries(byPlatform)
    .map(([platform, { mentioned, total }]) => ({
      platform,
      rate: total > 0 ? Math.round((mentioned / total) * 100) : 0,
      total,
    }))
    .sort((a, b) => b.rate - a.rate);

  const overallRate =
    mentions.length > 0
      ? Math.round((mentions.filter((m) => m.brandMentioned).length / mentions.length) * 100)
      : 0;

  // Prompt gaps: prompts where brand never appeared
  const promptMentionedEver = new Map<string, boolean>();
  const promptCompetitors = new Map<string, Set<string>>();
  const promptPlatforms = new Map<string, Set<string>>();

  for (const m of mentions) {
    if (!promptMentionedEver.has(m.promptId)) promptMentionedEver.set(m.promptId, false);
    if (m.brandMentioned) promptMentionedEver.set(m.promptId, true);

    if (!promptCompetitors.has(m.promptId)) promptCompetitors.set(m.promptId, new Set());
    m.competitorsMentioned
      .filter((c) => competitorNames.includes(c))
      .forEach((c) => promptCompetitors.get(m.promptId)!.add(c));

    if (!promptPlatforms.has(m.promptId)) promptPlatforms.set(m.promptId, new Set());
    promptPlatforms.get(m.promptId)!.add(PLATFORM_LABELS[m.platform] ?? m.platform);
  }

  const promptGaps = [...promptMentionedEver.entries()]
    .filter(([, mentioned]) => !mentioned)
    .map(([promptId]) => ({
      text: promptMap.get(promptId)?.text ?? "Unknown",
      competitors: [...(promptCompetitors.get(promptId) ?? [])],
      platforms: [...(promptPlatforms.get(promptId) ?? [])],
      score: (promptCompetitors.get(promptId)?.size ?? 0) * (promptPlatforms.get(promptId)?.size ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const winningPrompts = [...promptMentionedEver.entries()]
    .filter(([, mentioned]) => mentioned)
    .map(([promptId]) => ({
      text: promptMap.get(promptId)?.text ?? "Unknown",
      platforms: [...(promptPlatforms.get(promptId) ?? [])],
    }))
    .sort((a, b) => b.platforms.length - a.platforms.length)
    .slice(0, 5);

  // Competitor share of voice
  const totalMentions = mentions.length;
  const brandMentions = mentions.filter((m) => m.brandMentioned).length;
  const competitorMentionCounts: Record<string, number> = {};
  for (const m of mentions) {
    for (const comp of m.competitorsMentioned) {
      if (competitorNames.includes(comp)) {
        competitorMentionCounts[comp] = (competitorMentionCounts[comp] ?? 0) + 1;
      }
    }
  }

  const sovData = [
    { name: project.brandName, count: brandMentions },
    ...Object.entries(competitorMentionCounts).map(([name, count]) => ({ name, count })),
  ].sort((a, b) => b.count - a.count);

  // Citations
  const ownedCitations = citations.filter((c) => c.isOwned).length;
  const totalCitations = citations.length;

  // Briefs summary
  const briefsByStatus = briefs.reduce(
    (acc, b) => {
      acc[b.status] = (acc[b.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Top audit rec
  const topRec =
    latestAudit?.recommendations &&
    Array.isArray(latestAudit.recommendations) &&
    latestAudit.recommendations.length > 0
      ? (latestAudit.recommendations[0] as { title?: string })?.title ?? "Run a full AEO audit"
      : "Run a full AEO audit";

  return {
    brandName: project.brandName,
    websiteUrl: project.websiteUrl,
    overallRate,
    platformRates,
    promptGaps,
    winningPrompts,
    sovData,
    ownedCitations,
    totalCitations,
    latestAudit,
    topRec,
    briefsByStatus,
    totalPrompts: project.prompts.length,
    totalCompetitors: competitorNames.length,
    competitorNames,
  };
}

function buildSystemPrompt(ctx: NonNullable<Awaited<ReturnType<typeof buildContext>>>): string {
  const best = ctx.platformRates[0];
  const worst = ctx.platformRates[ctx.platformRates.length - 1];

  const platformLines = ctx.platformRates
    .map((p) => `  - ${p.platform}: ${p.rate}% mention rate (${p.total} prompts tracked)`)
    .join("\n");

  const gapLines = ctx.promptGaps
    .map(
      (g, i) =>
        `  ${i + 1}. "${g.text}" — competitors appearing: ${g.competitors.join(", ") || "none"}, missing on: ${g.platforms.join(", ") || "all platforms"} (priority score: ${g.score})`
    )
    .join("\n");

  const winLines = ctx.winningPrompts
    .map((w, i) => `  ${i + 1}. "${w.text}" — appearing on: ${w.platforms.join(", ")}`)
    .join("\n");

  const sovLines = ctx.sovData
    .map((s) => `  - ${s.name}: ${s.count} mentions`)
    .join("\n");

  const auditSection = ctx.latestAudit
    ? `LATEST AEO AUDIT (${new Date(ctx.latestAudit.createdAt).toLocaleDateString()}):
  - URL: ${ctx.latestAudit.url}
  - Overall Score: ${ctx.latestAudit.overallScore}/100
  - Crawlability: ${ctx.latestAudit.crawlabilityScore} | Schema: ${ctx.latestAudit.schemaScore} | Content: ${ctx.latestAudit.contentScore} | Authority: ${ctx.latestAudit.authorityScore}
  - Top Recommendation: ${ctx.topRec}`
    : "LATEST AEO AUDIT: No audit data available yet. Recommend running an audit first.";

  const briefs = ctx.briefsByStatus;
  const briefsSection = `CONTENT BRIEFS:
  - Generated (draft): ${briefs["GENERATED"] ?? 0}
  - Published: ${briefs["PUBLISHED"] ?? 0}
  - Pending: ${briefs["PENDING"] ?? 0}`;

  return `You are an expert AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) analyst for ${ctx.brandName}.
You have access to their complete AI visibility data. Answer questions using ONLY their actual data — be specific with numbers and percentages.
Always end your responses with 1-2 concrete next actions they can take.

When the user asks for a "summary" or "report", format your response as a structured weekly performance report with clear sections.
When the user asks "what should I do first" or "what should I prioritize", give a numbered 3-step action plan based on their actual gaps.
When the user asks about a specific platform, pull that platform's specific data.
Use markdown formatting: **bold** for key metrics, bullet points for lists, ## for section headers.

CURRENT PERFORMANCE DATA:

Brand: ${ctx.brandName}
Website: ${ctx.websiteUrl}
Tracked Prompts: ${ctx.totalPrompts}
Competitors Tracked: ${ctx.competitorNames.join(", ") || "None"}

OVERALL MENTION RATE: ${ctx.overallRate}%
${best ? `Best Platform: ${best.platform} at ${best.rate}%` : ""}
${worst && worst.platform !== best?.platform ? `Worst Platform: ${worst.platform} at ${worst.rate}%` : ""}

MENTION RATES BY PLATFORM:
${platformLines || "  No platform data available yet."}

TOP PROMPT GAPS (prompts where ${ctx.brandName} never appears):
${gapLines || "  No gaps detected — great visibility!"}

TOP WINNING PROMPTS (prompts where ${ctx.brandName} performs best):
${winLines || "  No win data available yet."}

SHARE OF VOICE VS COMPETITORS (raw mention counts):
${sovLines || "  No competitor data available."}

CITATION STATISTICS:
  - Total citations tracked: ${ctx.totalCitations}
  - Owned domain citations: ${ctx.ownedCitations} (${ctx.totalCitations > 0 ? Math.round((ctx.ownedCitations / ctx.totalCitations) * 100) : 0}%)
  - Third-party citations: ${ctx.totalCitations - ctx.ownedCitations} (${ctx.totalCitations > 0 ? Math.round(((ctx.totalCitations - ctx.ownedCitations) / ctx.totalCitations) * 100) : 0}%)

${auditSection}

${briefsSection}`;
}

// ---------------------------------------------------------------------------
// Fallback response (no API key)
// ---------------------------------------------------------------------------

function buildFallbackResponse(
  userMessage: string,
  ctx: NonNullable<Awaited<ReturnType<typeof buildContext>>>
): string {
  const lc = userMessage.toLowerCase();
  const best = ctx.platformRates[0];
  const worst = ctx.platformRates[ctx.platformRates.length - 1];
  const topGap = ctx.promptGaps[0];

  if (lc.includes("summar") || lc.includes("report") || lc.includes("overview")) {
    return `## Weekly Performance Summary for ${ctx.brandName}

**Overall Mention Rate: ${ctx.overallRate}%** across ${ctx.totalPrompts} tracked prompts.

### Platform Breakdown
${ctx.platformRates.map((p) => `- **${p.platform}**: ${p.rate}% mention rate`).join("\n")}

### Key Gaps
${ctx.promptGaps.slice(0, 3).map((g, i) => `${i + 1}. "${g.text}"`).join("\n") || "No gaps detected."}

### Share of Voice
${ctx.sovData.map((s) => `- ${s.name}: ${s.count} mentions`).join("\n") || "No competitor data."}

### Content Briefs
- ${ctx.briefsByStatus["GENERATED"] ?? 0} drafts, ${ctx.briefsByStatus["PUBLISHED"] ?? 0} published

**Next Actions:**
1. Generate briefs for your top ${ctx.promptGaps.length} prompt gaps
2. Focus content efforts on ${worst?.platform ?? "underperforming platforms"}`;
  }

  if (lc.includes("priorit") || lc.includes("first") || lc.includes("fix")) {
    return `## Your 3-Step AEO Action Plan

Based on your data, here's what to tackle in order:

**Step 1 — Close your biggest prompt gap**
${topGap ? `"${topGap.text}" — competitors like ${topGap.competitors.join(", ")} appear here but you don't. Generate a brief to create targeted content.` : "Run more scans to identify your gaps."}

**Step 2 — Boost ${worst?.platform ?? "your weakest platform"}**
Your ${worst?.platform ?? "lowest-performing platform"} shows a ${worst?.rate ?? 0}% mention rate vs ${best?.rate ?? 0}% on ${best?.platform ?? "your best platform"}. Optimize your content format for that platform's citation style.

**Step 3 — Increase owned citations**
Only ${ctx.ownedCitations} of your ${ctx.totalCitations} citations come from your own domain (${ctx.totalCitations > 0 ? Math.round((ctx.ownedCitations / ctx.totalCitations) * 100) : 0}%). Publish authoritative FAQ pages on ${ctx.brandName}'s website.

**Quick win:** ${ctx.latestAudit ? `Your AEO audit score is ${ctx.latestAudit.overallScore}/100 — focus on: ${ctx.topRec}` : "Run an AEO audit to identify technical issues."}`;
  }

  if (lc.includes("competitor") || lc.includes("outrank")) {
    const topComp = ctx.sovData.find((s) => s.name !== ctx.brandName);
    return `## Competitor Analysis

**${ctx.brandName}** appears in ${ctx.overallRate}% of tracked responses.

${topComp ? `**${topComp.name}** leads with ${topComp.count} total mentions vs your ${ctx.sovData.find((s) => s.name === ctx.brandName)?.count ?? 0}.` : ""}

**Where competitors appear but you don't:**
${ctx.promptGaps.slice(0, 3).map((g) => `- "${g.text}" — ${g.competitors.join(", ")} appear here`).join("\n") || "No competitive gaps detected."}

**Next actions:**
1. Create content targeting the prompts above
2. Focus on building E-E-A-T signals that AI models cite`;
  }

  // Generic
  return `Here's what your data shows for **${ctx.brandName}**:

- **Overall mention rate**: ${ctx.overallRate}% across ${ctx.totalPrompts} prompts
- **Best platform**: ${best?.platform ?? "N/A"} at ${best?.rate ?? 0}%
- **Top gap**: ${topGap ? `"${topGap.text}"` : "No gaps — great coverage!"}
- **AEO audit score**: ${ctx.latestAudit?.overallScore ?? "Not run yet"}/100

**Next actions:**
1. ${ctx.promptGaps.length > 0 ? `Generate a content brief for: "${ctx.promptGaps[0].text}"` : "Run a scan to find prompt gaps"}
2. ${ctx.latestAudit ? ctx.topRec : "Run your first AEO audit at /dashboard/audit"}`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { messages, projectId } = parsed.data;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch context data
    const ctx = await buildContext(projectId, session.user.id);
    if (!ctx) {
      return NextResponse.json({ error: "Failed to build context" }, { status: 500 });
    }

    const systemPrompt = buildSystemPrompt(ctx);

    // Fallback: no API key
    if (!process.env.OPENAI_API_KEY) {
      const lastUserMsg = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
      const fallback = buildFallbackResponse(lastUserMsg, ctx);
      // Stream the fallback word by word for a realistic feel
      const encoder = new TextEncoder();
      const words = fallback.split(" ");
      const readable = new ReadableStream({
        async start(controller) {
          for (const word of words) {
            controller.enqueue(encoder.encode(word + " "));
            await new Promise((r) => setTimeout(r, 20));
          }
          controller.close();
        },
      });
      return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }

    // OpenAI streaming
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const openaiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      stream: true,
      max_tokens: 1500,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[copilot/chat] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
