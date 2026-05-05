import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/copilot/sessions/[sessionId] — get session with all messages
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    const copilotSession = await prisma.copilotSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });

    if (!copilotSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: copilotSession.id,
      title: copilotSession.title,
      projectId: copilotSession.projectId,
      createdAt: copilotSession.createdAt.toISOString(),
      messages: copilotSession.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[copilot/sessions/[id] GET] error:", error);
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
  }
}

// DELETE /api/copilot/sessions/[sessionId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    const copilotSession = await prisma.copilotSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
    });
    if (!copilotSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await prisma.copilotSession.delete({ where: { id: sessionId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[copilot/sessions/[id] DELETE] error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
