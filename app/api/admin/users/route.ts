/**
 * GET /api/admin/users
 * Paginated, filterable user list.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const GET = adminRoute("VIEWER", async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const plan = searchParams.get("plan") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const sort = searchParams.get("sort") ?? "newest";
  const PAGE_SIZE = 50;

  const where: Record<string, unknown> = {
    adminRole: "NONE", // only end users
  };

  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  if (plan !== "all") {
    where.plan = plan.toUpperCase();
  }
  if (status === "banned") {
    where.adminBanned = true;
  } else if (status === "active") {
    where.adminBanned = false;
  }

  const orderBy =
    sort === "oldest"
      ? { createdAt: "asc" as const }
      : sort === "plan"
        ? { plan: "asc" as const }
        : { createdAt: "desc" as const };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
        adminBanned: true,
        stripeSubscriptionId: true,
        _count: {
          select: { projects: true },
        },
        projects: {
          select: { brandName: true },
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const PLAN_MRR: Record<string, number> = { STARTER: 79, GROWTH: 299, ENTERPRISE: 999, FREE: 0 };

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    brandName: u.projects[0]?.brandName ?? "—",
    plan: u.plan,
    createdAt: u.createdAt,
    lastActive: u.updatedAt,
    mrr: PLAN_MRR[u.plan] ?? 0,
    projectCount: u._count.projects,
    banned: u.adminBanned,
    hasStripe: !!u.stripeSubscriptionId,
  }));

  return NextResponse.json({
    users: rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
});
