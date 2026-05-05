import crypto from "crypto";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

/** Generate a unique tracking ID for an email send */
export function generateTrackingId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Generate an HMAC unsubscribe token for a user */
export function generateUnsubscribeToken(userId: string): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? process.env.NEXTAUTH_SECRET ?? "fallback-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(userId)
    .digest("hex")
    .slice(0, 32);
}

/** Verify an unsubscribe token */
export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = generateUnsubscribeToken(userId);
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
