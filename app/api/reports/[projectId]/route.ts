/**
 * GET /api/reports/[projectId]
 * Returns list of reports for a project (authenticated, owner only).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const reports = await prisma.report.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reportType: true,
      periodStart: true,
      periodEnd: true,
      pdfUrl: true,
      shareToken: true,
      viewCount: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ reports });
}
