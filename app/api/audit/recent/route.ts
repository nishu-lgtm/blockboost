import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const audits = await prisma.auditReport.findMany({
      where: { projectId },
      select: {
        id: true,
        url: true,
        overallScore: true,
        crawlabilityScore: true,
        schemaScore: true,
        contentScore: true,
        authorityScore: true,
        createdAt: true,
        rawData: true,
        recommendations: true,
        schemaTypesFound: true,
        robotsTxtBlocking: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json(
      audits.map((a) => ({
        id: a.id,
        url: a.url,
        overallScore: a.overallScore,
        crawlabilityScore: a.crawlabilityScore,
        schemaScore: a.schemaScore,
        contentScore: a.contentScore,
        authorityScore: a.authorityScore,
        createdAt: a.createdAt.toISOString(),
        // Reconstruct AuditResult shape from stored rawData
        auditedAt: a.createdAt.toISOString(),
        schemaTypesFound: a.schemaTypesFound,
        robotsTxtBlocking: a.robotsTxtBlocking,
        rawData: a.rawData,
        recommendations: a.recommendations,
      }))
    );
  } catch (error) {
    console.error("Recent audits error:", error);
    return NextResponse.json({ error: "Failed to load recent audits." }, { status: 500 });
  }
}
