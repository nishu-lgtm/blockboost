import { auth } from "@/lib/auth";
import { getGSCAuthUrl } from "@/lib/google-search-console";
import { signOAuthState } from "@/lib/oauth-state";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return new Response("GSC not configured (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)", {
      status: 503,
    });
  }

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") ?? "settings"; // "onboarding" | "settings"

  // HMAC-signed state with nonce + 10-min expiry — see lib/oauth-state.ts
  // for why unsigned base64 JSON state was an account-takeover vector.
  const state = signOAuthState({ userId: session.user.id, source });
  const authUrl = getGSCAuthUrl(state);
  return Response.redirect(authUrl);
}
