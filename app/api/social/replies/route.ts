import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateReplies } from "@/lib/reply-generator";
import { SocialReplyTone } from "@prisma/client";

const generateSchema = z.object({
  opportunityId: z.string(),
});

const saveSchema = z.object({
  opportunityId: z.string(),
  draftText: z.string().min(1),
  finalText: z.string().optional(),
  tone: z.nativeEnum(SocialReplyTone),
  approved: z.boolean().optional().default(false),
});

const markPostedSchema = z.object({
  replyId: z.string(),
  postUrl: z.string().url().optional(),
});

// POST /api/social/replies?action=generate|save|mark-posted
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "generate";
  const body = await req.json();

  if (action === "generate") {
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const opp = await prisma.socialOpportunity.findFirst({
      where: {
        id: parsed.data.opportunityId,
        project: { userId: session.user.id },
      },
      include: {
        project: {
          select: {
            brandName: true,
            businessCategory: true,
            city: true,
            prompts: { select: { text: true }, take: 5 },
          },
        },
      },
    });
    if (!opp) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Check plan gating — Growth+ only
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });
    if (!user || !["GROWTH", "AGENCY", "ENTERPRISE"].includes(user.plan)) {
      return NextResponse.json(
        { error: "Social Listening requires Growth or Enterprise plan" },
        { status: 403 }
      );
    }

    // Per-user AI quota gate
    const { consumeAiQuota } = await import("@/lib/ai-quota");
    const quotaResult = consumeAiQuota(session.user.id, user.plan);
    if (!quotaResult.ok) {
      return NextResponse.json(
        {
          error: `Daily AI quota exceeded for your ${quotaResult.plan} plan (${quotaResult.quota} actions/day).`,
        },
        { status: 429, headers: { "Retry-After": String(quotaResult.retryAfterSec ?? 3600) } }
      );
    }

    const project = opp.project as {
      brandName: string;
      businessCategory: string | null;
      city: string | null;
      prompts: { text: string }[];
    };

    const result = await generateReplies({
      opportunityId: opp.id,
      platform: opp.platform,
      postTitle: opp.title,
      postBody: opp.body,
      subreddit: opp.subreddit,
      brandName: project.brandName,
      city: project.city ?? "",
      businessCategory: project.businessCategory ?? "local business",
      keyServices: project.prompts.map((p) => p.text).slice(0, 3),
    });

    // Mark opportunity as VIEWED
    await prisma.socialOpportunity.update({
      where: { id: opp.id },
      data: { status: "VIEWED" },
    });

    return NextResponse.json(result);
  }

  if (action === "save") {
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const opp = await prisma.socialOpportunity.findFirst({
      where: {
        id: parsed.data.opportunityId,
        project: { userId: session.user.id },
      },
    });
    if (!opp) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Upsert reply for this opportunity + tone
    const existing = await prisma.socialReply.findFirst({
      where: { opportunityId: opp.id, tone: parsed.data.tone },
    });

    const reply = existing
      ? await prisma.socialReply.update({
          where: { id: existing.id },
          data: {
            draftText: parsed.data.draftText,
            finalText: parsed.data.finalText,
            approved: parsed.data.approved,
          },
        })
      : await prisma.socialReply.create({
          data: {
            opportunityId: opp.id,
            projectId: opp.projectId,
            draftText: parsed.data.draftText,
            finalText: parsed.data.finalText,
            tone: parsed.data.tone,
            approved: parsed.data.approved,
          },
        });

    return NextResponse.json(reply);
  }

  if (action === "mark-posted") {
    const parsed = markPostedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const reply = await prisma.socialReply.findFirst({
      where: {
        id: parsed.data.replyId,
        opportunity: { project: { userId: session.user.id } },
      },
    });
    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    const [updatedReply] = await prisma.$transaction([
      prisma.socialReply.update({
        where: { id: reply.id },
        data: {
          postedAt: new Date(),
          postUrl: parsed.data.postUrl,
          approved: true,
        },
      }),
      prisma.socialOpportunity.update({
        where: { id: reply.opportunityId },
        data: { status: "REPLIED", repliedAt: new Date() },
      }),
    ]);

    return NextResponse.json(updatedReply);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// GET /api/social/replies?projectId=... — list posted replies
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
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const replies = await prisma.socialReply.findMany({
    where: { projectId, postedAt: { not: null } },
    include: {
      opportunity: {
        select: {
          title: true,
          platform: true,
          url: true,
          subreddit: true,
        },
      },
    },
    orderBy: { postedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ replies });
}
