import { auth } from "@/lib/auth";
import { getGSCAuthUrl } from "@/lib/google-search-console";

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

  // Encode state as base64url JSON so the callback knows who initiated and where to redirect
  const state = Buffer.from(
    JSON.stringify({ userId: session.user.id, source })
  ).toString("base64url");

  const authUrl = getGSCAuthUrl(state);
  return Response.redirect(authUrl);
}
