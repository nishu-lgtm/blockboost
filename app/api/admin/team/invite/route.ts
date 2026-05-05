import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { AdminRole } from "@prisma/client";

export const POST = adminRoute("ADMIN", async (req: NextRequest, { admin }) => {
  const { email, role } = (await req.json()) as { email: string; role: string };

  if (!email || !role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }

  if (!Object.values(AdminRole).includes(role as AdminRole) || role === "NONE") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Only SUPERADMIN can invite SUPERADMIN
  if (role === "SUPERADMIN" && admin.adminRole !== "SUPERADMIN") {
    return NextResponse.json({ error: "Only SUPERADMIN can grant SUPERADMIN role" }, { status: 403 });
  }

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    return NextResponse.json(
      { error: "User must have a BlockBoost account first" },
      { status: 404 },
    );
  }

  await prisma.user.update({
    where: { email },
    data: { adminRole: role as AdminRole },
  });

  // Send invite email
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (resend) {
    const appUrl = process.env.NEXTAUTH_URL ?? "https://blockboost.co";
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@blockboost.co",
      to: email,
      subject: "You've been added to the BlockBoost admin team",
      html: `<p>Hi,</p>
<p>${admin.name ?? admin.email} has added you as a <strong>${role}</strong> on the BlockBoost admin team.</p>
<p><a href="${appUrl}/admin">Access the admin panel →</a></p>
<p>You'll need to set up two-factor authentication on your first visit.</p>`,
    });
  }

  await logAudit({
    adminUserId: admin.id,
    action: "INVITE_ADMIN",
    targetId: existing.id,
    details: { email, role },
  });

  return NextResponse.json({ ok: true, userId: existing.id });
});
