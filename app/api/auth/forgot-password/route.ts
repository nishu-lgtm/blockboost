import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  email: z.string().email(),
});

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";
const FROM = process.env.EMAIL_FROM ?? "Tom from BlockBoost <tom@blockboost.co>";

function generateResetToken(userId: string): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "";
  const timestamp = Date.now().toString();
  const payload = `${userId}.${timestamp}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  // Always return 200 to avoid user enumeration
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = generateResetToken(user.id);
  const resetUrl = `${APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
  const firstName = (user.name ?? "there").split(" ")[0];

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM,
      to: user.email,
      subject: "Reset your BlockBoost password",
      html: `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">Reset your password</h1>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Hi ${firstName},</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">We received a request to reset your password. Click the button below to set a new one. This link expires in 1 hour.</p>
    <p style="margin:0 0 24px;"><a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Reset password</a></p>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 16px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">— The BlockBoost team</p>
  </div>
</body></html>`,
    });
  } catch (err) {
    console.error("[forgot-password] Resend failed:", err);
    // Still return 200 — don't reveal whether email exists
  }

  return NextResponse.json({ ok: true });
}
