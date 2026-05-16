/**
 * POST /api/admin/users/[id]/impersonate — STUBBED.
 * DELETE /api/admin/users/[id]/impersonate — End impersonation (clears cookie).
 *
 * The impersonation feature was set up to write a `bb_impersonate` cookie
 * and show an ImpersonationBanner, but NO API/page route ever read the
 * cookie to substitute the effective userId. Admins who pressed "Impersonate"
 * saw a banner saying they were impersonating a user, while their actual
 * session continued to operate on their own account.
 *
 * That's actively misleading (admins might believe they're seeing the user's
 * data while reading their own), so we stub the POST until we implement
 * `getEffectiveUserId()` everywhere a user lookup happens.
 *
 * The DELETE handler is kept so any users with stale cookies can clean up.
 *
 * Audit finding 2026-05-16.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";

const COOKIE_NAME = "bb_impersonate";
const INFO_COOKIE = "bb_impersonate_info";

export const POST = adminRoute(
  "SUPPORT",
  async (_req: NextRequest, { admin, params }) => {
    const { id } = await params!;
    await logAudit({
      adminUserId: admin.id,
      action: "IMPERSONATE_ATTEMPT_BLOCKED",
      targetType: "user",
      targetId: id,
    });
    return NextResponse.json(
      {
        error:
          "User impersonation is currently disabled. Direct DB query or ask the user to share a screenshot to debug their account.",
      },
      { status: 501 }
    );
  }
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
  }
);
