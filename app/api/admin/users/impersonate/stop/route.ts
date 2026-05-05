/** POST /api/admin/users/impersonate/stop — Stop impersonation from user dashboard */

import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("bb_impersonate");
  res.cookies.delete("bb_impersonate_info");
  return res;
}
