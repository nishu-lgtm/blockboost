import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyVerificationToken } from "@/lib/email-verification";

/**
 * GET /api/auth/verify-email?token=...
 * Sets emailVerified = now() if the HMAC token is valid + < 7d old.
 * Redirects to /auth/verify-email?status=success|expired|invalid.
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${origin}/auth/verify-email?status=invalid`);
  }

  const verified = verifyVerificationToken(token);
  if (!verified) {
    return NextResponse.redirect(`${origin}/auth/verify-email?status=expired`);
  }

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, emailVerified: true },
  });

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/verify-email?status=invalid`);
  }

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
  }

  return NextResponse.redirect(`${origin}/auth/verify-email?status=success`);
}
