import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { BriefContent, BriefQualityScore, PromptGapRow } from "@/lib/brief-types";

const PLATFORM_LABELS: Record<string, string> = {
  CHATGPT: "ChatGPT", PERPLEXITY: "Perplexity", GEMINI: "Gemini",
  COPILOT: "Copilot", GROK: "Grok", GOOGLE_AI_OVERVIEWS: "Google AIO",
};

function computeQualityScore(content: BriefContent): BriefQualityScore {
  const directAnswerWords = content.directAnswer?.trim().split(/\s+/).length ?? 0;
  const daScore = directAnswerWords <= 55 ? 100 : 40;
  const headScore = content.headings.length
    ? Math.round((content.headings.filter((h) => h.endsWith("?")).length / content.headings.length) * 100)
    : 0;
  const breakdown = {
    directAnswer: daScore,
    headings: headScore,
    faqCoverage: Math.min(100, Math.round((content.faqs.length / 10) * 100)),
    keywords: content.keywords.length >= 5 ? 100 : Math.round((content.keywords.length / 5) * 100),
    eeat: content.eeatRecommendations.length >= 3 ? 100 : Math.round((content.eeatRecommendations.length / 3) * 100),
  };
  const total = Math.round(
    breakdown.directAnswer * 0.3 + breakdown.headings * 0.2 +
    breakdown.faqCoverage * 0.2 + breakdown.keywords * 0.15 + breakdown.eeat * 0.15
  );
  return { total, breakdown };
}

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
        prompts: { orderBy: { createdAt: "asc" } },
        competitors: true,
      },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const [briefs, allMentions] = await Promise.all([
      prisma.contentBrief.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.mention.findMany({
        where: { projectId },
        select: { promptId: true, platform: true, brandMentioned: true, competitorsMentioned: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Build brief lookup by promptText
    const briefByPrompt = new Map(briefs.map((b) => [b.promptText, b]));

    // Compute prompt gaps
    const competitorNames = project.competitors.map((c) => c.brandName);
    const gapRows: PromptGapRow[] = [];

    for (const prompt of project.prompts) {
      const promptMentions = allMentions.filter((m) => m.promptId === prompt.id);
      const brandEver = promptMentions.some((m) => m.brandMentioned);
      if (brandEver) continue; // not a gap

      const platformsMissing = [...new Set(promptMentions.map((m) => PLATFORM_LABELS[m.platform] ?? m.platform))];
      const competitorsAppearing = [...new Set(
        promptMentions.flatMap((m) => m.competitorsMentioned.filter((c) => competitorNames.includes(c)))
      )];
      const priorityScore = competitorsAppearing.length * platformsMissing.length;
      const existingBrief = briefByPrompt.get(prompt.text);

      gapRows.push({
        promptId: prompt.id,
        promptText: prompt.text,
        category: prompt.category,
        platformsMissing,
        competitorsAppearing,
        priorityScore,
        hasBrief: !!existingBrief,
        briefId: existingBrief?.id ?? null,
      });
    }

    gapRows.sort((a, b) => b.priorityScore - a.priorityScore);

    // Shape briefs
    const briefRows = briefs.map((b) => {
      const content = b.briefContent as unknown as BriefContent | null;
      return {
        id: b.id,
        projectId: b.projectId,
        promptText: b.promptText,
        topic: b.topic,
        status: b.status as "PENDING" | "GENERATED" | "PUBLISHED",
        briefContent: content,
        schemaMarkup: b.schemaMarkup,
        qualityScore: content ? computeQualityScore(content) : null,
        createdAt: b.createdAt.toISOString(),
        wordCountEstimate: content?.targetWordCount ?? null,
      };
    });

    return NextResponse.json({ briefs: briefRows, gapRows });
  } catch (error) {
    console.error("Briefs list error:", error);
    return NextResponse.json({ error: "Failed to load briefs." }, { status: 500 });
  }
}
