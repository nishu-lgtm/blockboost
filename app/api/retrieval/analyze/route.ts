import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeUrl, findRelevantChunks } from "@/lib/retrieval-engine";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { projectId, url } = body as { projectId?: string; url?: string };
  if (!projectId || !url) {
    return NextResponse.json({ error: "projectId and url required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id as string },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { chunksStored } = await analyzeUrl(projectId, url);

  // Score against all prompts if chunks were stored
  const prompts = await prisma.prompt.findMany({
    where: { projectId },
    select: { text: true },
    take: 5,
  });

  const scores = await Promise.all(
    prompts.map((p) => findRelevantChunks(projectId, p.text, 3))
  );

  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((s, r) => s + r.retrievabilityScore, 0) / scores.length)
      : 0;

  return NextResponse.json({ chunksStored, retrievabilityScore: avgScore, scores });
}
