import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/password-policy";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getTokenSecretOrNull } from "@/lib/token-secret";

const bodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1),
});

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function verifyResetToken(token: string): { userId: string } | null {
  // Fail-closed if secret is missing/too short — returning null here is the
  // same external behaviour as an invalid token, so no information leak.
  const secret = getTokenSecretOrNull();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, timestamp, providedSig] = parts;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return null;
  if (Date.now() - ts > TOKEN_TTL_MS) return null;

  // HMAC-SHA256 hex is always exactly 64 chars — reject obviously wrong
  // lengths before timingSafeEqual (which crashes on length mismatch).
  if (providedSig.length !== 64) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${userId}.${timestamp}`)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedSig))) {
    return null;
  }

  return { userId };
}

export async function POST(req: Request) {
  // Rate limit: HMAC token format `userId.ts.sig` exposes userId; rate-limit per IP
  // to prevent attackers from brute-forcing the signature for a known userId.
  const ip = clientIp(req);
  const limited = rateLimit(`reset-password:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many reset attempts. Try again in ${limited.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { token, newPassword } = parsed.data;

  const policy = validatePassword(newPassword);
  if (!policy.ok) {
    return NextResponse.json({ error: policy.error }, { status: 400 });
  }

  const verified = verifyResetToken(token);
  if (!verified) {
    return NextResponse.json(
      { error: "Reset link is invalid or expired" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, passwordChangedAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  // Reject tokens issued before the user's last password change.
  // This invalidates a reset token after it's been used once (because
  // the password change updates passwordChangedAt to "now"), and also
  // invalidates any other tokens that were issued for this user.
  const tokenTs = Number(token.split(".")[1]);
  if (user.passwordChangedAt && tokenTs <= user.passwordChangedAt.getTime()) {
    return NextResponse.json(
      { error: "Reset link has already been used" },
      { status: 400 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: newHash, passwordChangedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
