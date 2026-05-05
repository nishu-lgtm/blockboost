import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { CATEGORY_SUBREDDITS } from "@/lib/social-scanner";

const settingsSchema = z.object({
  projectId: z.string(),
  redditEnabled: z.boolean().optional(),
  quoraEnabled: z.boolean().optional(),
  linkedinEnabled: z.boolean().optional(),
  monitorKeywords: z.array(z.string()).optional(),
  excludeKeywords: z.array(z.string()).optional(),
  targetSubreddits: z.array(z.string()).optional(),
  minimumUpvotes: z.number().min(0).max(1000).optional(),
  minimumAICitationScore: z.number().min(0).max(100).optional(),
  notifyOnNew: z.boolean().optional(),
  guidelinesAcceptedAt: z.string().optional(), // ISO date
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: {
      socialSettings: true,
      prompts: { select: { text: true }, take: 20 },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Build suggested subreddits from category
  const category = (project as { businessCategory?: string }).businessCategory ?? "general";
  const suggestedSubreddits = CATEGORY_SUBREDDITS[category] ?? [];

  // Auto-keywords from prompts
  const autoKeywords = project.prompts
    .map((p) => p.text.split(" ").slice(0, 4).join(" "))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 10);

  return NextResponse.json({
    settings: project.socialSettings,
    suggestedSubreddits,
    autoKeywords,
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { projectId, guidelinesAcceptedAt, ...rest } = parsed.data;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const updateData = {
    ...rest,
    ...(guidelinesAcceptedAt
      ? { guidelinesAcceptedAt: new Date(guidelinesAcceptedAt) }
      : {}),
  };

  const settings = await prisma.socialSettings.upsert({
    where: { projectId },
    create: { projectId, ...updateData },
    update: updateData,
  });

  return NextResponse.json(settings);
}
