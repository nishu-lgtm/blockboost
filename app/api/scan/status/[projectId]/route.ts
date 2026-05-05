import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Latest mention (proxy for last scan timestamp)
    const latestMention = await prisma.mention.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    // Aggregate stats
    const [totalMentions, brandMentionedCount, citationCount] = await Promise.all([
      prisma.mention.count({ where: { projectId } }),
      prisma.mention.count({ where: { projectId, brandMentioned: true } }),
      prisma.citation.count({ where: { projectId } }),
    ]);

    const mentionRate =
      totalMentions > 0
        ? Math.round((brandMentionedCount / totalMentions) * 100)
        : 0;

    return NextResponse.json({
      projectId,
      lastScanAt: latestMention?.createdAt ?? null,
      summary: {
        totalMentions,
        mentionRate,
        citationsFound: citationCount,
      },
    });
  } catch (error) {
    console.error("Scan status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scan status." },
      { status: 500 }
    );
  }
}
