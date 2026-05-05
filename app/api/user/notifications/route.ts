import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/user/notifications — update notification preferences

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { emailNotifications?: boolean };

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(typeof body.emailNotifications === "boolean"
          ? { emailNotifications: body.emailNotifications }
          : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[user/notifications] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}

// GET /api/user/notifications — fetch current preferences

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailNotifications: true,
        slackConnected: true,
        slackWebhookUrl: true,
      },
    });

    return NextResponse.json(user ?? { emailNotifications: true, slackConnected: false });
  } catch (error) {
    console.error("[user/notifications] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}
