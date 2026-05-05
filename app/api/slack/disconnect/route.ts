import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/slack/disconnect — remove Slack webhook

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        slackWebhookUrl: null,
        slackConnected: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[slack/disconnect] error:", error);
    return NextResponse.json({ error: "Failed to disconnect Slack" }, { status: 500 });
  }
}
