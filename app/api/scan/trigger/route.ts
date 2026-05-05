import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runScan, platformsForPlan } from "@/lib/scan-engine";

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

    console.log(
      `[scan/trigger] Scan triggered for project ${projectId} (${project.brandName}) ` +
        `plan=${plan} platforms=${enabledPlatforms.join(",")}`
    );

    // Run the scan synchronously.
    // In production you would enqueue this as a background job (Inngest, Trigger.dev, etc.)
    // and return 202 immediately.  For the current architecture we run inline and return
    // the summary so the onboarding UI can show immediate feedback.
    const summary = await runScan(projectId, plan);

    // Fire email trigger for first scan completion (fire-and-forget)
    const userId = session.user?.id;
    if (userId) {
      const mentionRate = summary.mentionRate ?? 0;
      const topOpportunity = "Improve your AI visibility score";
      import("@/lib/email-triggers").then(({ onFirstScanComplete }) =>
        onFirstScanComplete(userId, mentionRate, topOpportunity).catch(
          (e) => console.error("[scan/trigger] onFirstScanComplete failed:", e)
        )
      );
    }

    return NextResponse.json(
      {
        success: true,
        projectId,
        plan,
        platforms: enabledPlatforms,
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Scan trigger error:", error);
    return NextResponse.json(
      { error: "Failed to trigger scan. Please try again." },
      { status: 500 }
    );
  }
}
