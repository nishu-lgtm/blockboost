import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens } from "@/lib/google-search-console";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // User denied access
  if (error) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?gsc=denied`);
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?gsc=error`);
  }

  // Decode state
  let userId: string;
  let source: string;
  try {
    const decoded = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
    userId = decoded.userId;
    source = decoded.source ?? "settings";
  } catch {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?gsc=error`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    await prisma.user.update({
      where: { id: userId },
      data: {
        gscAccessToken: tokens.accessToken,
        gscRefreshToken: tokens.refreshToken,
        gscTokenExpiry: tokens.expiresAt,
        gscConnected: true,
      },
    });

    // Fire GSC-connected trigger (fire-and-forget)
    import("@/lib/email-triggers").then(({ onGSCConnected }) =>
      onGSCConnected(userId).catch((e) =>
        console.error("[gsc/callback] onGSCConnected failed:", e)
      )
    );

    const redirectPath =
      source === "onboarding"
        ? `/onboarding?step=2&gsc=connected`
        : `/dashboard/settings?tab=integrations&gsc=connected`;

    return NextResponse.redirect(`${baseUrl}${redirectPath}`);
  } catch (err) {
    console.error("[gsc/callback] token exchange failed:", err);
    const redirectPath =
      source === "onboarding"
        ? `/onboarding?step=2&gsc=error`
        : `/dashboard/settings?tab=integrations&gsc=error`;
    return NextResponse.redirect(`${baseUrl}${redirectPath}`);
  }
}
