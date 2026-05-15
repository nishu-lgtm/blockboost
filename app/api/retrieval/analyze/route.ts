import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeUrl, findRelevantChunks } from "@/lib/retrieval-engine";

const bodySchema = z.object({
  projectId: z.string().cuid(),
  url: z.string().url().max(2048),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { projectId, url } = parsed.data;

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
