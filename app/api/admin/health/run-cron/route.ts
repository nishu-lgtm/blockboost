import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";

export const POST = adminRoute("ADMIN", async (req: NextRequest, { admin }) => {
  const { job } = (await req.json()) as { job: string };

  const ALLOWED_JOBS: Record<string, string> = {
    "daily-scan": "/api/cron/daily-scan",
    "weekly-report": "/api/cron/weekly-report",
  };

  const cronPath = ALLOWED_JOBS[job];
  if (!cronPath) {
    return NextResponse.json({ error: "Unknown cron job" }, { status: 400 });
  }

  await logAudit({
    adminUserId: admin.id,
    action: "TRIGGER_CRON",
    details: { job },
  });

  // Call cron endpoint internally
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}${cronPath}`, {
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
      },
    });
    const data = await res.json();
    return NextResponse.json({ ok: true, job, result: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
});
