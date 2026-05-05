import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plan } from "@prisma/client";

const PLAN_COMPETITOR_LIMITS: Record<Plan, number> = {
  FREE: 2,
  STARTER: 3,
  GROWTH: 5,
  ENTERPRISE: 10,
};

const competitorSchema = z.object({
  competitors: z.array(
    z.object({
      id: z.string().optional(),        // existing competitor id (omit for new)
      brandName: z.string().min(1, "Brand name required").max(100),
      websiteUrl: z.string().max(500).optional().default(""),
    })
  ),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: { user: { select: { plan: true } } },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = competitorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { competitors } = parsed.data;
    const limit = PLAN_COMPETITOR_LIMITS[project.user.plan];

    if (competitors.length > limit) {
      return NextResponse.json(
        { error: `Your plan allows up to ${limit} competitors. Please upgrade to add more.` },
        { status: 422 }
      );
    }

    // Replace all competitors for this project in a transaction
    await prisma.$transaction([
      prisma.competitor.deleteMany({ where: { projectId } }),
      prisma.competitor.createMany({
        data: competitors.map((c) => ({
          brandName: c.brandName.trim(),
          websiteUrl: c.websiteUrl?.trim() ?? "",
          projectId,
        })),
      }),
    ]);

    const updated = await prisma.competitor.findMany({
      where: { projectId },
      select: { id: true, brandName: true, websiteUrl: true },
      orderBy: { createdAt: "asc" },
    });

    // Fire competitor-added trigger (fire-and-forget)
    const userId = session.user?.id;
    if (competitors.length > 0 && userId) {
      import("@/lib/email-triggers").then(({ onCompetitorAdded }) =>
        onCompetitorAdded(userId).catch((e) =>
          console.error("[competitors] onCompetitorAdded failed:", e)
        )
      );
    }

    return NextResponse.json({ competitors: updated });
  } catch (error) {
    console.error("Update competitors error:", error);
    return NextResponse.json(
      { error: "Failed to update competitors." },
      { status: 500 }
    );
  }
}
