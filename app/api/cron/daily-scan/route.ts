/**
 * Vercel Cron endpoint — runs daily at 06:00 UTC.
 * Protected by the CRON_SECRET environment variable.
 *
 * Vercel automatically sets the Authorization header to "Bearer <CRON_SECRET>"
 * when invoking cron jobs.  For local testing, pass the header manually.
 */

import { NextResponse } from "next/server";
import { runDailyScansForAllProjects } from "@/lib/scheduler";
import { runWithCronTracking } from "@/lib/cron-runner";

export const maxDuration = 300; // allow up to 5 minutes for Vercel Pro

export async function GET(req: Request) {
  // Validate cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/daily-scan] CRON_SECRET is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  const expectedHeader = `Bearer ${cronSecret}`;
  if (authHeader !== expectedHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron/daily-scan] Starting daily scan job…");

  try {
    const report = await runWithCronTracking("daily-scan", () =>
      runDailyScansForAllProjects()
    );
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error("[cron/daily-scan] Fatal error:", err);
    return NextResponse.json(
      { error: "Daily scan job failed", detail: String(err) },
      { status: 500 }
    );
  }
}
