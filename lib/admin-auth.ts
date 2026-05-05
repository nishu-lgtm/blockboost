/**
 * Admin auth helpers — server-side only.
 * Use these in API routes and server components under /admin.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  adminRole: AdminRole;
  totpEnabled: boolean;
};

// ---------------------------------------------------------------------------
// Role hierarchy helpers
// ---------------------------------------------------------------------------

const ROLE_RANK: Record<AdminRole, number> = {
  NONE: 0,
  VIEWER: 1,
  SUPPORT: 2,
  ADMIN: 3,
  SUPERADMIN: 4,
};

export function hasRole(userRole: AdminRole, required: AdminRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

// ---------------------------------------------------------------------------
// Session helpers for server components & API routes
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated admin user or null.
 * Also verifies they are not banned.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      adminRole: true,
      totpEnabled: true,
      adminBanned: true,
    },
  });

  if (!user || user.adminRole === "NONE" || user.adminBanned) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    adminRole: user.adminRole,
    totpEnabled: user.totpEnabled,
  };
}

// ---------------------------------------------------------------------------
// API route guard factory
// ---------------------------------------------------------------------------

type RouteHandler = (
  req: NextRequest,
  ctx: { admin: AdminUser; params?: Promise<Record<string, string>> },
) => Promise<NextResponse | Response>;

/**
 * Wraps an API route handler with admin auth + role check.
 *
 * Usage:
 *   export const POST = adminRoute("SUPPORT", async (req, { admin }) => { ... })
 */
export function adminRoute(
  required: AdminRole,
  handler: RouteHandler,
) {
  return async (
    req: NextRequest,
    { params }: { params?: Promise<Record<string, string>> } = {},
  ) => {
    const admin = await getAdminUser();

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasRole(admin.adminRole, required)) {
      return NextResponse.json(
        { error: `Requires ${required} role` },
        { status: 403 },
      );
    }

    return handler(req, { admin, params });
  };
}

// ---------------------------------------------------------------------------
// Impersonation helpers
// ---------------------------------------------------------------------------

export const IMPERSONATION_COOKIE = "bb_impersonate";

export function getImpersonatedUserId(req: NextRequest): string | null {
  return req.cookies.get(IMPERSONATION_COOKIE)?.value ?? null;
}
