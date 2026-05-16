import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSlackAuthUrl } from "@/lib/slack";
import { signOAuthState } from "@/lib/oauth-state";

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

    // HMAC-signed state w/ nonce + 10-min expiry. Previously trusted unsigned
    // base64 JSON, which let attackers bind their Slack workspace webhook to
    // a victim's user record by forging the userId field.
    const state = signOAuthState({ userId: session.user.id, source: "settings" });
    const authUrl = getSlackAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[slack/connect] error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=notifications&slack=error", process.env.NEXTAUTH_URL!)
    );
  }
}
