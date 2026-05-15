import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeGaps } from "@/lib/gap-analyzer";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id as string },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const rows = await analyzeGaps(projectId);
  return NextResponse.json({ rows });
}
