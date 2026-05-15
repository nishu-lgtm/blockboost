import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDeliveryBundle } from "@/lib/delivery-builder";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { projectId } = body as { projectId?: string };
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id as string },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const bundle = await buildDeliveryBundle(projectId);
  return NextResponse.json(bundle);
}
