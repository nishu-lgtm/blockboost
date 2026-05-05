import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const POST = adminRoute("ADMIN", async (_req: NextRequest, { admin, params }) => {
  const { id } = await params!;

  await prisma.user.update({
    where: { id },
    data: { adminBanned: false, adminBanReason: null },
  });

  await logAudit({ adminUserId: admin.id, action: "UNBAN_USER", targetType: "user", targetId: id });
  return NextResponse.json({ ok: true });
});
