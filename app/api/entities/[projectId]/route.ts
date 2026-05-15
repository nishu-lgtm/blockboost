import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractAndStoreEntities, getEntityGraph } from "@/lib/entity-extractor";

// 50k chars ≈ 12.5k tokens, well under 4o-mini context. Cap protects against
// users pasting a whole book and bombing the LLM token budget.
const extractBodySchema = z.object({
  text: z.string().min(1).max(50_000),
});

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

  const graph = await getEntityGraph(projectId);
  return NextResponse.json(graph);
}

export async function POST(
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

  const parsed = extractBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { text } = parsed.data;

  const summary = await extractAndStoreEntities(projectId, project.brandName, text);
  const graph = await getEntityGraph(projectId);
  return NextResponse.json({ ...summary, graph });
}
