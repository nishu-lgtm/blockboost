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
  if (!user || (user.plan !== "GROWTH" && user.plan !== "ENTERPRISE")) {
    return NextResponse.json(
      { error: "Social Listening requires Growth or Enterprise plan" },
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
