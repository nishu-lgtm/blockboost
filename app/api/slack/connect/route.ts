import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSlackAuthUrl } from "@/lib/slack";

// GET /api/slack/connect — initiate Slack OAuth

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/auth/login", process.env.NEXTAUTH_URL!));
    }

    if (!process.env.SLACK_CLIENT_ID) {
      return NextResponse.json(
        { error: "Slack integration not configured. Add SLACK_CLIENT_ID to environment variables." },
        { status: 503 }
      );
    }

    // Encode user ID as state for CSRF protection
    const state = Buffer.from(JSON.stringify({ userId: session.user.id })).toString("base64url");
    const authUrl = getSlackAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[slack/connect] error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=notifications&slack=error", process.env.NEXTAUTH_URL!)
    );
  }
}
