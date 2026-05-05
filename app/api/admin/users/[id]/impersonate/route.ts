/**
 * POST /api/admin/users/[id]/impersonate — Start impersonation
 * DELETE /api/admin/users/[id]/impersonate — End impersonation
 */

import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "bb_impersonate";
const INFO_COOKIE = "bb_impersonate_info";

export const POST = adminRoute(
  "SUPPORT",
  async (req: NextRequest, { admin, params }) => {
    const { id } = await params!;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { email: true, adminRole: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cannot impersonate admins
    if (target.adminRole !== "NONE") {
      return NextResponse.json({ error: "Cannot impersonate admin users" }, { status: 403 });
    }

    await logAudit({
      adminUserId: admin.id,
      action: "IMPERSONATE_START",
      targetType: "user",
      targetId: id,
      details: { targetEmail: target.email },
    });

    const res = NextResponse.json({ ok: true, redirectTo: "/dashboard" });

    // Set impersonation cookies (httpOnly for security + readable for banner)
    const maxAge = 60 * 60; // 1 hour
    res.cookies.set(COOKIE_NAME, id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    res.cookies.set(
      INFO_COOKIE,
      encodeURIComponent(JSON.stringify({ email: target.email, adminId: admin.id })),
      { httpOnly: false, sameSite: "lax", maxAge, path: "/" },
    );

    return res;
  },
);

export const DELETE = adminRoute(
  "SUPPORT",
  async (_req: NextRequest, { admin, params }) => {
    const { id } = await params!;
    await logAudit({
      adminUserId: admin.id,
      action: "IMPERSONATE_END",
      targetType: "user",
      targetId: id,
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(COOKIE_NAME);
    res.cookies.delete(INFO_COOKIE);
    return res;
  },
);
