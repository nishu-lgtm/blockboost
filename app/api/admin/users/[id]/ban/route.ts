import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const POST = adminRoute("ADMIN", async (req: NextRequest, { admin, params }) => {
  const { id } = await params!;
  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };

  await prisma.user.update({
    where: { id },
    data: { adminBanned: true, adminBanReason: reason ?? "Banned by admin" },
  });

  await logAudit({
    adminUserId: admin.id,
    action: "BAN_USER",
    targetType: "user",
    targetId: id,
    details: { reason },
  });

  return NextResponse.json({ ok: true });
});
