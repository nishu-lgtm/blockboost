/**
 * GET /api/reports/share/[shareToken]
 * Public endpoint — no auth required. Returns report JSON data.
 * Increments viewCount on each access.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> },
) {
  const { shareToken } = await params;

  const report = await prisma.report.findUnique({
    where: { shareToken },
    include: {
      project: { select: { name: true, brandName: true } },
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Increment view count (non-blocking)
  prisma.report
    .update({ where: { id: report.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  return NextResponse.json({
    reportId: report.id,
    shareToken: report.shareToken,
    pdfUrl: report.pdfUrl,
    reportType: report.reportType,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    createdAt: report.createdAt,
    project: report.project,
    data: report.data,
  });
}
