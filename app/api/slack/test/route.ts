import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postToSlack } from "@/lib/slack";

/**
 * Sends a test message to the user's connected Slack webhook.
 * Used by the "Send test message" button in Settings → Notifications.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { slackWebhookUrl: true, slackConnected: true, name: true },
  });

  if (!user?.slackConnected || !user.slackWebhookUrl) {
    return NextResponse.json(
      { error: "Slack is not connected" },
      { status: 400 }
    );
  }

  try {
    await postToSlack(user.slackWebhookUrl, {
      type: "SCAN_COMPLETE",
      message: `This is a test alert from BlockBoost. If you see this, your Slack integration is working correctly. ✅`,
      data: {},
      brandName: user.name ?? "BlockBoost user",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[slack/test] Failed to post test message:", err);
    return NextResponse.json(
      { error: "Failed to send test message. Webhook may be invalid or revoked." },
      { status: 500 }
    );
  }
}
