import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getScanStatus } from "@/lib/scan-status";

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

    const status = await getScanStatus(projectId);

    // citation count is the only legacy field not in ScanStatus — keep for back-compat
    const citationsFound = await prisma.citation.count({ where: { projectId } });

    return NextResponse.json({
      projectId,
      // Legacy fields (still consumed by older client code):
      lastScanAt: status.lastScannedAt,
      summary: {
        totalMentions: status.totalMentions,
        mentionRate: status.mentionRate,
        citationsFound,
      },
      // New richer fields for ScanStatusBanner:
      state: status.state,
      suspectedScraperIssue: status.suspectedScraperIssue,
      apifyApprovalUrl: status.apifyApprovalUrl,
    });
  } catch (error) {
    console.error("Scan status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scan status." },
      { status: 500 }
    );
  }
}
