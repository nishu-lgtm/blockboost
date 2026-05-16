/**
 * Signed OAuth state for third-party integrations (GSC, Slack, future).
 *
 * BEFORE this module each callback decoded base64 JSON state and trusted
 * the `userId` inside — an attacker who knew (or guessed) a victim's
 * userId could connect their OWN third-party account to the victim's
 * VisibilityIQ record by:
 *   1. Starting OAuth normally for their own Google/Slack account
 *   2. Tampering with the state param to put the victim's userId in it
 *   3. Hitting the callback URL with the manipulated state
 *
 * AFTER: state is HMAC-signed with NEXTAUTH_SECRET + includes a random
 * nonce + 10-minute expiry. Callbacks reject any state that's missing,
 * tampered with, replayed past expiry, or wasn't issued by us.
 *
 * Audit finding 2026-05-16.
 */
import crypto from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — enough for slow OAuth flows

interface StatePayload {
  userId: string;
  source: string;       // e.g. "settings" | "onboarding"
  nonce: string;        // random — prevents replay
  iat: number;          // issued-at ms
}

function getStateSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("NEXTAUTH_SECRET missing or too short — cannot sign OAuth state");
  }
  return secret;
}

/**
 * Generate a signed state token to put in the `state=` query param of an
 * OAuth authorization URL. Format:
 *   base64url(payload-JSON) . hex(HMAC-SHA256(payload-JSON, NEXTAUTH_SECRET))
 */
export function signOAuthState(opts: { userId: string; source?: string }): string {
  const secret = getStateSecret();
  const payload: StatePayload = {
    userId: opts.userId,
    source: opts.source ?? "settings",
    nonce: crypto.randomBytes(16).toString("hex"),
    iat: Date.now(),
  };
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

/**
 * Verify a state returned by the OAuth provider. Returns the decoded payload
 * on success, or null on any failure (tampering, expiry, missing fields,
 * misconfigured secret). Treats null exactly the same way an invalid state
 * would have been treated — no information leak.
 */
export function verifyOAuthState(state: string | null | undefined): {
  userId: string;
  source: string;
} | null {
  if (!state || typeof state !== "string") return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [b64, providedSig] = parts;
  if (providedSig.length !== 64) return null;

  let secret: string;
  try { secret = getStateSecret(); } catch { return null; }

  const expectedSig = crypto.createHmac("sha256", secret).update(b64).digest("hex");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(providedSig))) {
      return null;
    }
  } catch { return null; }

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch { return null; }

  if (typeof payload.userId !== "string" || typeof payload.iat !== "number") return null;
  if (Date.now() - payload.iat > STATE_TTL_MS) return null;

  return { userId: payload.userId, source: payload.source ?? "settings" };
}
