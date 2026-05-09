import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scanProject } from "@/lib/social-scanner";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await req.json();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  // Verify plan (Growth+ only)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  // Plan gate must match opportunities + replies endpoints (GROWTH/AGENCY/ENTERPRISE).
  // Previously missing AGENCY here meant agency users could view opportunities and
  // generate replies but couldn't trigger a scan to populate them.
  const allowed = ["GROWTH", "AGENCY", "ENTERPRISE"];
  if (!user || !allowed.includes(user.plan)) {
    return NextResponse.json(
      { error: "Social Listening requires Growth, Agency, or Enterprise plan" },
      { status: 403 }
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const results = await scanProject(projectId);

  return NextResponse.json({
    success: true,
    saved: results.reddit + results.quora + results.linkedin,
    breakdown: results,
  });
}
