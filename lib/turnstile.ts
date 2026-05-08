/**
 * Cloudflare Turnstile (CAPTCHA replacement) verification.
 *
 * Set TURNSTILE_SITEKEY (public, exposed to client) and TURNSTILE_SECRET
 * (server-only) to enable. When env vars are missing, verifyTurnstile()
 * returns { ok: true } so dev/preview environments still work without
 * needing keys — this is intentional, NOT a bypass for production.
 *
 * Sign up at: https://dash.cloudflare.com/?to=/:account/turnstile
 */

export const TURNSTILE_ENABLED = !!process.env.TURNSTILE_SECRET;
export const TURNSTILE_SITEKEY = process.env.TURNSTILE_SITEKEY ?? "";

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!TURNSTILE_ENABLED) return { ok: true };

  if (!token) {
    return { ok: false, error: "Please complete the human-verification challenge." };
  }

  try {
    const params = new URLSearchParams();
    params.set("secret", process.env.TURNSTILE_SECRET!);
    params.set("response", token);
    if (remoteIp) params.set("remoteip", remoteIp);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }
    );
    const data = (await res.json()) as { success: boolean };
    if (!data.success) {
      return { ok: false, error: "Verification failed. Please try again." };
    }
    return { ok: true };
  } catch (err) {
    console.error("[turnstile] verify error:", err);
    return { ok: false, error: "Verification service unavailable." };
  }
}
