import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface QueryInsightRow {
  promptId: string;
  promptText: string;
  category: string;
  gscImpressions: number;
  gscClicks: number;
  gscPosition: number;
  aiMentionRate: number; // 0-100
  gapScore: number;      // (impressions/100) × (100 - aiMentionRate)
  priority: "critical" | "opportunity" | "winning" | "normal";
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get prompts that have GSC data
    const prompts = await prisma.prompt.findMany({
      where: { projectId, gscImpressions: { not: null } },
      select: {
        id: true,
        text: true,
        category: true,
        gscImpressions: true,
        gscClicks: true,
        gscPosition: true,
      },
    });

    if (prompts.length === 0) {
      return NextResponse.json([]);
    }

    // Compute AI mention rate per prompt
    const mentions = await prisma.mention.findMany({
      where: { projectId, promptId: { in: prompts.map((p) => p.id) } },
      select: { promptId: true, brandMentioned: true },
    });

    const mentionMap: Record<string, { total: number; mentioned: number }> = {};
    for (const m of mentions) {
      if (!mentionMap[m.promptId]) mentionMap[m.promptId] = { total: 0, mentioned: 0 };
      mentionMap[m.promptId].total++;
      if (m.brandMentioned) mentionMap[m.promptId].mentioned++;
    }

    const rows: QueryInsightRow[] = prompts
      .map((p) => {
        const impressions = p.gscImpressions ?? 0;
        const clicks = p.gscClicks ?? 0;
        const position = p.gscPosition ?? 0;
        const stats = mentionMap[p.id];
        const aiMentionRate =
          stats && stats.total > 0
            ? Math.round((stats.mentioned / stats.total) * 100)
            : 0;
        const gapScore = Math.round((impressions / 100) * (100 - aiMentionRate));

        let priority: QueryInsightRow["priority"] = "normal";
        if (impressions >= 1000 && aiMentionRate < 30) priority = "critical";
        else if (impressions >= 500 && aiMentionRate < 50) priority = "opportunity";
        else if (aiMentionRate >= 70) priority = "winning";

        return {
          promptId: p.id,
          promptText: p.text,
          category: p.category,
          gscImpressions: impressions,
          gscClicks: clicks,
          gscPosition: position,
          aiMentionRate,
          gapScore,
          priority,
        };
      })
      .sort((a, b) => b.gapScore - a.gapScore);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[gsc/insights] error:", error);
    return NextResponse.json({ error: "Failed to load query intelligence" }, { status: 500 });
  }
}
