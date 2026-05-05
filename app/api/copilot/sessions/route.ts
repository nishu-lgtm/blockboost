import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET /api/copilot/sessions?projectId=xxx — list sessions for a project
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const sessions = await prisma.copilotSession.findMany({
      where: { projectId, userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true, role: true },
        },
        _count: { select: { messages: true } },
      },
    });

    const result = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      messageCount: s._count.messages,
      lastMessage: s.messages[0]
        ? {
            snippet: s.messages[0].content.slice(0, 80),
            role: s.messages[0].role,
            createdAt: s.messages[0].createdAt.toISOString(),
          }
        : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[copilot/sessions GET] error:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}

// POST /api/copilot/sessions — create a new session
const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { projectId, title } = parsed.data;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const copilotSession = await prisma.copilotSession.create({
      data: {
        projectId,
        userId: session.user.id,
        title: title ?? "New conversation",
      },
    });

    return NextResponse.json({
      id: copilotSession.id,
      title: copilotSession.title,
      createdAt: copilotSession.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[copilot/sessions POST] error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
