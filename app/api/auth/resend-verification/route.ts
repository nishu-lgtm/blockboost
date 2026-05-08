import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-verification";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/resend-verification
 * Rate-limited (1 / 5 min) so users can't spam the inbox.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = clientIp(req);
  const limited = rateLimit(`verify-resend:${session.user.id}:${ip}`, 1, 5 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Please wait ${limited.retryAfter}s before requesting another email.` },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, emailVerified: true },
  });

  if (!user || !user.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ error: "Email is already verified." }, { status: 400 });
  }

  await sendVerificationEmail({ to: user.email, name: user.name, userId: user.id });
  return NextResponse.json({ ok: true });
}
