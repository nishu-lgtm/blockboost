import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeSlackCode } from "@/lib/slack";

const APP_URL = process.env.NEXTAUTH_URL!;

// GET /api/slack/callback — Slack OAuth callback

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = `${APP_URL}/dashboard/settings?tab=notifications`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${settingsUrl}&slack=error`);
  }

  try {
    // Decode state to get userId
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      userId: string;
    };
    const userId = decoded.userId;

    if (!userId) {
      return NextResponse.redirect(`${settingsUrl}&slack=error`);
    }

    // Exchange code for webhook URL
    const { webhookUrl } = await exchangeSlackCode(code);

    // Save to user record
    await prisma.user.update({
      where: { id: userId },
      data: {
        slackWebhookUrl: webhookUrl,
        slackConnected: true,
      },
    });

    return NextResponse.redirect(`${settingsUrl}&slack=connected`);
  } catch (err) {
    console.error("[slack/callback] error:", err);
    return NextResponse.redirect(`${settingsUrl}&slack=error`);
  }
}
