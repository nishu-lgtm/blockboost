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

import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Providers that are conditionally registered in lib/auth.ts. If the env vars
// aren't set, the provider isn't loaded — but NextAuth's built-in /api/auth/signin/<id>
// URL still exists and returns a generic "Configuration" error page. We intercept
// those calls here so users get redirected to a working sign-in path instead of
// landing on the cryptic /auth/error page (the bug nishuprasad75 hit on 2026-05-15).
const PROVIDER_GUARD: Array<{ id: string; envCheck: () => boolean }> = [
  { id: "google", envCheck: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) },
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Provider guard: redirect to /auth/login if user hits a signin URL for a
  // provider that isn't configured (e.g. cached Google button from old build).
  for (const p of PROVIDER_GUARD) {
    const hit = pathname === `/api/auth/signin/${p.id}` ||
                pathname === `/api/auth/callback/${p.id}`;
    if (hit && !p.envCheck()) {
      const url = new URL("/auth/login", req.url);
      url.searchParams.set("msg", `${p.id}-unavailable`);
      return NextResponse.redirect(url);
    }
  }

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
  matcher: ["/admin/:path*", "/api/auth/signin/:provider", "/api/auth/callback/:provider"],
};
