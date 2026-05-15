import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDeliveryBundle } from "@/lib/delivery-builder";

/**
 * GET /api/delivery/download/[projectId]?file=llm.md|facts.json|entities.json
 *
 * Returns a single file download. Requires ?file= query param.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const file = req.nextUrl.searchParams.get("file");

  if (!file || !["llm.md", "facts.json", "entities.json"].includes(file)) {
    return NextResponse.json(
      { error: "file param must be llm.md, facts.json, or entities.json" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id as string },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const bundle = await buildDeliveryBundle(projectId);

  const contentMap: Record<string, string> = {
    "llm.md": bundle.llmMd,
    "facts.json": bundle.factsJson,
    "entities.json": bundle.entitiesJson,
  };

  const contentTypeMap: Record<string, string> = {
    "llm.md": "text/markdown; charset=utf-8",
    "facts.json": "application/json; charset=utf-8",
    "entities.json": "application/json; charset=utf-8",
  };

  const content = contentMap[file];
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": contentTypeMap[file],
      "Content-Disposition": `attachment; filename="${file}"`,
    },
  });
}
