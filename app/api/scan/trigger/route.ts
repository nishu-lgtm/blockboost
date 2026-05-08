import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runScan, platformsForPlan } from "@/lib/scan-engine";

// Allow up to 5 minutes if the scan is forced synchronous (Pro plan only).
// In async mode (the default) the request returns in <1s.
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Verify the project belongs to the requesting user and fetch plan
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: { user: { select: { plan: true } } },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const plan = project.user.plan;
    const enabledPlatforms = platformsForPlan(plan);
    const userId = session.user.id;

    console.log(
      `[scan/trigger] Scan queued for project ${projectId} (${project.brandName}) ` +
        `plan=${plan} platforms=${enabledPlatforms.join(",")}`
    );

    // ASYNC: dispatch the scan in the background and return 202 immediately.
    // Apify scrapers can take minutes; awaiting here would time out at the
    // Vercel serverless function limit. The client polls /api/scan/status
    // for completion. Errors are logged; the user sees the status flip in
    // the UI when the scan finishes.
    void runScan(projectId, plan)
      .then((summary) => {
        const mentionRate = summary.mentionRate ?? 0;
        const topOpportunity = "Improve your AI visibility score";
        return import("@/lib/email-triggers").then(({ onFirstScanComplete }) =>
          onFirstScanComplete(userId, mentionRate, topOpportunity).catch((e) =>
            console.error("[scan/trigger] onFirstScanComplete failed:", e)
          )
        );
      })
      .catch((err) =>
        console.error(`[scan/trigger] Background scan failed for ${projectId}:`, err)
      );

    return NextResponse.json(
      {
        success: true,
        queued: true,
        projectId,
        plan,
        platforms: enabledPlatforms,
        message: "Scan started — results typically ready in 2-5 minutes.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Scan trigger error:", error);
    return NextResponse.json(
      { error: "Failed to trigger scan. Please try again." },
      { status: 500 }
    );
  }
}
