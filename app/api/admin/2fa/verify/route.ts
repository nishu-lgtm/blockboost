/**
 * POST /api/admin/2fa/verify
 * Verifies TOTP code and marks totpEnabled = true on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = (await req.json()) as { code?: string };
  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "Invalid code format" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { adminRole: true, totpSecret: true },
  });

  if (!user || user.adminRole === "NONE" || !user.totpSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { authenticator } = await import("otplib");
    const valid = authenticator.verify({ token: code, secret: user.totpSecret });

    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpEnabled: true },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // otplib not installed — accept any 6-digit code in dev
    if (process.env.NODE_ENV === "development") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { totpEnabled: true },
      });
      return NextResponse.json({ ok: true, _dev: "2FA bypassed (otplib not installed)" });
    }
    return NextResponse.json({ error: "2FA not configured on server" }, { status: 500 });
  }
}
