/**
 * Email verification token system.
 *
 * Token format: `${userId}.${timestamp}.${HMAC-SHA256(userId.timestamp, secret)}`
 * TTL: 7 days from issue.
 *
 * The same EMAIL_UNSUBSCRIBE_SECRET is reused as the HMAC key — it's just
 * cryptographic randomness and the token shape is namespaced by the route
 * that consumes it.
 */
import crypto from "crypto";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateVerificationToken(userId: string): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "";
  const ts = Date.now().toString();
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`verify.${userId}.${ts}`)
    .digest("hex");
  return `${userId}.${ts}.${sig}`;
}

export function verifyVerificationToken(
  token: string
): { userId: string } | null {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "";
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, timestamp, providedSig] = parts;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return null;
  if (Date.now() - ts > TOKEN_TTL_MS) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`verify.${userId}.${timestamp}`)
    .digest("hex");

  if (
    expected.length !== providedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedSig))
  ) {
    return null;
  }
  return { userId };
}

export async function sendVerificationEmail(opts: {
  to: string;
  name: string | null;
  userId: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email-verification] RESEND_API_KEY not set — skipping send");
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const token = generateVerificationToken(opts.userId);
  const appUrl = process.env.NEXTAUTH_URL ?? "https://blockboost.co";
  const verifyLink = `${appUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
  const from =
    process.env.EMAIL_FROM ?? "BlockBoost <onboarding@resend.dev>";

  const firstName = (opts.name ?? "there").split(" ")[0];

  await resend.emails.send({
    from,
    to: opts.to,
    subject: "Verify your email — BlockBoost",
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;padding:32px;">
          <div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:32px;">
            <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px;">Welcome, ${firstName}!</h1>
            <p style="color:#475569;line-height:1.6;font-size:14px;">
              Confirm your email address to keep your BlockBoost account secure
              and make sure you receive AI visibility alerts.
            </p>
            <div style="margin:24px 0;">
              <a href="${verifyLink}"
                 style="display:inline-block;background:#f59e0b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                Verify my email →
              </a>
            </div>
            <p style="color:#94a3b8;font-size:12px;line-height:1.5;">
              This link is valid for 7 days. If you didn't sign up for BlockBoost,
              you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
  });
}
