import crypto from "crypto";
import { requireTokenSecret, getTokenSecretOrNull } from "@/lib/token-secret";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

/** Generate a unique tracking ID for an email send */
export function generateTrackingId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate an HMAC unsubscribe token for a user. Throws if the secret is
 * missing/too short — previously fell back to "fallback-secret" which made
 * every unsub link forgeable. (Audit finding 2026-05-16.)
 */
export function generateUnsubscribeToken(userId: string): string {
  const secret = requireTokenSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(userId)
    .digest("hex")
    .slice(0, 32);
}

/** Verify an unsubscribe token. Returns false if secret is misconfigured. */
export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const secret = getTokenSecretOrNull();
  if (!secret) return false;
  // Token is 32 hex chars (truncated); reject obvious mismatches before
  // timingSafeEqual to avoid throwing on length difference.
  if (typeof token !== "string" || token.length !== 32) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(userId)
    .digest("hex")
    .slice(0, 32);
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Render a React Email component to HTML string */
export async function renderEmail(
  component: React.ReactElement
): Promise<string> {
  const { render } = await import("@react-email/render");
  return render(component);
}

// Import React for JSX (used by renderEmail callers)
import React from "react";

export { APP_URL };
