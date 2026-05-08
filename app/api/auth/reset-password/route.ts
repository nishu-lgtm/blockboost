import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function verifyResetToken(token: string): { userId: string } | null {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "";
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, timestamp, providedSig] = parts;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return null;
  if (Date.now() - ts > TOKEN_TTL_MS) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${userId}.${timestamp}`)
    .digest("hex");

  if (
    expected.length !== providedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedSig))
  ) {
    return null;
  }

  return { userId };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const { token, newPassword } = parsed.data;

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
