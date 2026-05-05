import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

export const POST = adminRoute("SUPPORT", async (req: NextRequest, { admin, params }) => {
  const { id } = await params!;
  const { days = 7 } = (await req.json().catch(() => ({}))) as { days?: number };

  const user = await prisma.user.findUnique({ where: { id }, select: { trialEndsAt: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const base = user.trialEndsAt ?? new Date();
  const newEnd = addDays(base, days);

  await prisma.user.update({ where: { id }, data: { trialEndsAt: newEnd } });
  await logAudit({
    adminUserId: admin.id,
    action: "EXTEND_TRIAL",
    targetType: "user",
    targetId: id,
    details: { days, newEnd },
  });

  return NextResponse.json({ ok: true, trialEndsAt: newEnd });
});
