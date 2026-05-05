import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  // Optionally update the session title (used after first user message)
  title: z.string().max(200).optional(),
});

// POST /api/copilot/sessions/[sessionId]/messages — append messages to a session
export async function POST(
  req: Request,
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

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { messages, title } = parsed.data;

    // Upsert messages + optionally update title in a transaction
    await prisma.$transaction([
      prisma.copilotMessage.createMany({
        data: messages.map((m) => ({
          sessionId,
          role: m.role,
          content: m.content,
        })),
      }),
      prisma.copilotSession.update({
        where: { id: sessionId },
        data: {
          updatedAt: new Date(),
          ...(title ? { title } : {}),
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[copilot/sessions/[id]/messages POST] error:", error);
    return NextResponse.json({ error: "Failed to save messages" }, { status: 500 });
  }
}
