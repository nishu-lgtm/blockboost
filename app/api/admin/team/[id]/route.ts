import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const DELETE = adminRoute("ADMIN", async (_req: NextRequest, { admin, params }) => {
  const { id } = await params!;

  if (id === admin.id) {
    return NextResponse.json({ error: "Cannot revoke your own access" }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data: { adminRole: "NONE" } });
  await logAudit({ adminUserId: admin.id, action: "REVOKE_ADMIN", targetId: id });

  return NextResponse.json({ ok: true });
});
