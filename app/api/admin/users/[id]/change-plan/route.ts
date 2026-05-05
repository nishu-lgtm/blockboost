import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Plan } from "@prisma/client";

export const POST = adminRoute("ADMIN", async (req: NextRequest, { admin, params }) => {
  const { id } = await params!;
  const { plan } = (await req.json()) as { plan: string };

  if (!Object.values(Plan).includes(plan as Plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const prev = await prisma.user.findUnique({ where: { id }, select: { plan: true } });
  await prisma.user.update({ where: { id }, data: { plan: plan as Plan } });
  await logAudit({
    adminUserId: admin.id,
    action: "CHANGE_PLAN",
    targetType: "user",
    targetId: id,
    details: { from: prev?.plan, to: plan },
  });

  return NextResponse.json({ ok: true });
});
