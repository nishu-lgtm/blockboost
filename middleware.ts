/**
 * Next.js middleware — handles admin route protection.
 *
 * The edge runtime cannot connect to Prisma/Postgres directly.
 * Admin role is embedded in the JWT by auth.ts callbacks, so we
 * read it from the token without hitting the DB.
 *
 * Rules for /admin/*:
 *   1. Must be authenticated
 *   2. Must have adminRole !== "NONE"
 *   3. (If not /admin/setup-2fa) must have totpEnabled = true
 *
 * On failure: redirect silently to /dashboard (never reveal /admin exists).
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAdminPath = pathname.startsWith("/admin");

  if (!isAdminPath) return NextResponse.next();

  const session = req.auth;

  // Not authenticated → redirect to dashboard (don't reveal /admin)
  if (!session?.user) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const user = session.user as {
    id?: string;
    adminRole?: string;
    totpEnabled?: boolean;
  };

  const role = user.adminRole ?? "NONE";

  // Not an admin → silently redirect
  if (role === "NONE") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 2FA check — allow /admin/setup-2fa through without 2FA
  const is2faSetup = pathname.startsWith("/admin/setup-2fa");
  if (!user.totpEnabled && !is2faSetup) {
    return NextResponse.redirect(new URL("/admin/setup-2fa", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
