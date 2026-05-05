/**
 * POST /api/reports/generate
 * Compile report data, render PDF, upload to Vercel Blob, save Report record.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compileReportData } from "@/lib/report-compiler";
import { renderToBuffer } from "@react-pdf/renderer";
import { put } from "@vercel/blob";
import { ReportPDF } from "@/components/report/ReportPDF";
import { createElement } from "react";
import { ReportType } from "@prisma/client";
import { startOfMonth, subDays } from "date-fns";

// ---------------------------------------------------------------------------
// Plan limits
// ---------------------------------------------------------------------------

const MONTHLY_LIMITS: Record<string, number> = {
  FREE: 1,
  STARTER: 3,
  GROWTH: Infinity,
  ENTERPRISE: Infinity,
};

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const { projectId, startDate, endDate, reportType = "ONDEMAND" } = body as {
    projectId?: string;
    startDate?: string;
    endDate?: string;
    reportType?: string;
  };

  if (!projectId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "projectId, startDate and endDate are required" },
      { status: 400 },
    );
  }

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Plan limit check — count reports generated this calendar month
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const monthStart = startOfMonth(new Date());
  const reportsThisMonth = await prisma.report.count({
    where: { userId, createdAt: { gte: monthStart } },
  });
  const limit = MONTHLY_LIMITS[user.plan] ?? 1;
  if (reportsThisMonth >= limit) {
    return NextResponse.json(
      {
        error: `Your ${user.plan} plan allows ${limit} report${limit === 1 ? "" : "s"} per month. Upgrade to generate more.`,
        code: "PLAN_LIMIT",
      },
      { status: 403 },
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // 1. Compile data
  const reportData = await compileReportData(projectId, start, end);

  // 2. Fetch branding (ENTERPRISE users)
  const branding = await prisma.reportBranding.findUnique({ where: { userId } });

  // 3. Render PDF to buffer
  const element = createElement(ReportPDF, {
    data: reportData,
    branding: branding
      ? {
          logoUrl: branding.logoUrl,
          primaryColor: branding.primaryColor,
          companyName: branding.companyName,
          tagline: branding.tagline,
          showWatermark: branding.showWatermark,
        }
      : {},
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any);

  // 4. Upload to Vercel Blob
  let pdfUrl: string | null = null;
  try {
    const filename = `reports/${userId}/${projectId}-${Date.now()}.pdf`;
    const blob = await put(filename, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
    });
    pdfUrl = blob.url;
  } catch (err) {
    console.warn("[reports/generate] Blob upload failed:", err);
    // Continue without PDF URL — data is still saved
  }

  // 5. Save Report record
  const report = await prisma.report.create({
    data: {
      projectId,
      userId,
      reportType: (reportType as ReportType) ?? ReportType.ONDEMAND,
      periodStart: start,
      periodEnd: end,
      data: reportData as object,
      pdfUrl,
    },
  });

  const shareUrl = `${process.env.NEXTAUTH_URL ?? ""}/report/${report.shareToken}`;

  return NextResponse.json({
    reportId: report.id,
    shareToken: report.shareToken,
    pdfUrl,
    shareUrl,
  });
}
