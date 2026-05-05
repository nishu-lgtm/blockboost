import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SocialPlatform, SocialOpportunityStatus } from "@prisma/client";
import { z } from "zod";

const querySchema = z.object({
  projectId: z.string(),
  platform: z.nativeEnum(SocialPlatform).optional(),
  status: z.nativeEnum(SocialOpportunityStatus).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  sort: z.enum(["score", "newest", "active"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { projectId, platform, status, minScore, sort, page, limit } = parsed.data;

  // Verify project belongs to user
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const where = {
    projectId,
    ...(platform ? { platform } : {}),
    ...(status ? { status } : {}),
    ...(minScore ? { aiCitationProbability: { gte: minScore } } : {}),
    ...(status !== "SNOOZED" ? { OR: [
      { snoozedUntil: null },
      { snoozedUntil: { lte: new Date() } },
    ]} : {}),
  };

  const orderBy =
    sort === "newest"
      ? { foundAt: "desc" as const }
      : sort === "active"
      ? { commentCount: "desc" as const }
      : { aiCitationProbability: "desc" as const };

  const [opportunities, total] = await Promise.all([
    prisma.socialOpportunity.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        replies: {
          select: { id: true, tone: true, approved: true, postedAt: true, aiCited: true },
        },
      },
    }),
    prisma.socialOpportunity.count({ where }),
  ]);

  return NextResponse.json({ opportunities, total, page, limit });
}
