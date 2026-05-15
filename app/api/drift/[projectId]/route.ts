import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeProjectDrift } from "@/lib/drift-detector";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id as string },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const windowParam = req.nextUrl.searchParams.get("window");
  const windowDays = windowParam ? Math.min(30, Math.max(1, parseInt(windowParam))) : 7;

  const report = await analyzeProjectDrift(projectId, windowDays);
  return NextResponse.json(report);
}
