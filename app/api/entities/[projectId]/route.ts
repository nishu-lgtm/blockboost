import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractAndStoreEntities, getEntityGraph } from "@/lib/entity-extractor";

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

  const body = await req.json().catch(() => ({}));
  const { text } = body as { text?: string };
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const summary = await extractAndStoreEntities(projectId, project.brandName, text);
  const graph = await getEntityGraph(projectId);
  return NextResponse.json({ ...summary, graph });
}
