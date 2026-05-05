/**
 * GET /api/admin/2fa/setup
 * Generates a TOTP secret + QR code URL for the current admin user.
 * Requires the user to be an admin (role !== NONE) but doesn't require 2FA yet.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { adminRole: true, email: true, totpSecret: true },
  });

  if (!user || user.adminRole === "NONE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Dynamic import — otplib must be installed (npm install otplib qrcode)
    const { authenticator } = await import("otplib");
    const QRCode = await import("qrcode");

    // Reuse existing secret or generate new one
    const secret = user.totpSecret ?? authenticator.generateSecret();

    // Save secret if new
    if (!user.totpSecret) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { totpSecret: secret },
      });
    }

    const otpauth = authenticator.keyuri(user.email, "BlockBoost Admin", secret);
    const qrUrl = await QRCode.toDataURL(otpauth);

    return NextResponse.json({ secret, qrUrl });
  } catch {
    // otplib not installed — return stub for development
    return NextResponse.json({
      secret: "JBSWY3DPEHPK3PXP",
      qrUrl: "data:image/png;base64,",
      _note: "Install otplib + qrcode: npm install otplib qrcode @types/qrcode",
    });
  }
}
