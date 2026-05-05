import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";

export const PUT = adminRoute("ADMIN", async (req: NextRequest, { admin, params }) => {
  const { id } = await params!;
  const { role } = (await req.json()) as { role: string };

  if (!Object.values(AdminRole).includes(role as AdminRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  // Only SUPERADMIN can grant SUPERADMIN
  if (role === "SUPERADMIN" && admin.adminRole !== "SUPERADMIN") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  // Cannot demote yourself
  if (id === admin.id && role === "NONE") {
    return NextResponse.json({ error: "Cannot remove your own admin access" }, { status: 400 });
  }

  const prev = await prisma.user.findUnique({ where: { id }, select: { adminRole: true } });
  await prisma.user.update({ where: { id }, data: { adminRole: role as AdminRole } });
  await logAudit({
    adminUserId: admin.id,
    action: "UPDATE_ROLE",
    targetId: id,
    details: { from: prev?.adminRole, to: role },
  });

  return NextResponse.json({ ok: true });
});
