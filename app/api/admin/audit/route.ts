import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const GET = adminRoute("VIEWER", async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const adminId = searchParams.get("adminId") ?? undefined;
  const action = searchParams.get("action") ?? undefined;
  const targetId = searchParams.get("targetId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const exportCsv = searchParams.get("export") === "csv";
  const PAGE_SIZE = 50;

  const where: Record<string, unknown> = {};
  if (adminId) where.adminUserId = adminId;
  if (action) where.action = action;
  if (targetId) where.targetId = targetId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  if (exportCsv) {
    const logs = await prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: { adminUser: { select: { name: true, email: true, adminRole: true } } },
    });

    const header = "id,action,admin_email,admin_role,target_id,ip,created_at\n";
    const rows = logs
      .map((l) =>
        [
          l.id,
          l.action,
          l.adminUser.email,
          l.adminUser.adminRole,
          l.targetId ?? "",
          l.ipAddress ?? "",
          l.createdAt.toISOString(),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-log-${Date.now()}.csv"`,
      },
    });
  }

  const [logs, total, admins] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        adminUser: { select: { name: true, email: true, adminRole: true } },
      },
    }),
    prisma.adminAuditLog.count({ where }),
    prisma.user.findMany({
      where: { adminRole: { not: "NONE" } },
      select: { id: true, name: true, email: true, adminRole: true },
    }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    admins,
  });
});
