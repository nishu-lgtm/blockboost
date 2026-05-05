/**
 * Scheduler helpers for the daily cron scan.
 *
 * The actual cron endpoint lives at /api/cron/daily-scan.
 * Vercel Cron triggers it via vercel.json at 06:00 UTC every day.
 * The endpoint is protected with a shared CRON_SECRET.
 */

import { prisma } from "@/lib/prisma";
import { runScan } from "@/lib/scan-engine";

export interface DailyScanReport {
  projectsScanned: number;
  projectsSkipped: number;
  errors: Array<{ projectId: string; error: string }>;
}

/**
 * Find all projects and run a scan for each one.
 * Projects are processed sequentially to avoid overwhelming the Apify API.
 * A failed scan for one project does not abort the rest.
 */
export async function runDailyScansForAllProjects(): Promise<DailyScanReport> {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      brandName: true,
      user: { select: { plan: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const report: DailyScanReport = {
    projectsScanned: 0,
    projectsSkipped: 0,
    errors: [],
  };

  for (const project of projects) {
    const plan = project.user.plan;

    try {
      console.log(
        `[scheduler] Running daily scan for project "${project.brandName}" (${project.id}) plan=${plan}`
      );
      await runScan(project.id, plan);
      report.projectsScanned++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scheduler] Scan failed for project ${project.id}:`, message);
      report.errors.push({ projectId: project.id, error: message });
      report.projectsSkipped++;
    }
  }

  console.log("[scheduler] Daily scan complete:", report);
  return report;
}
