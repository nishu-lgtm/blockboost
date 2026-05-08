/**
 * Scheduler helpers for the daily cron scan.
 *
 * The actual cron endpoint lives at /api/cron/daily-scan.
 * Vercel Cron triggers it via vercel.json at 06:00 UTC every day.
 * The endpoint is protected with a shared CRON_SECRET.
 */

import { prisma } from "@/lib/prisma";
import { runScan } from "@/lib/scan-engine";
import { scanProject } from "@/lib/social-scanner";

export interface DailyScanReport {
  projectsScanned: number;
  projectsSkipped: number;
  errors: Array<{ projectId: string; error: string }>;
}

/**
 * Per-plan minimum interval (in days) between automated scans.
 * Projects whose `lastScannedAt` is more recent than this are skipped today.
 */
const SCAN_INTERVAL_DAYS: Record<string, number> = {
  FREE: 7,
  STARTER: 3,
  GROWTH: 1,
  AGENCY: 1,
  ENTERPRISE: 1,
};

const BATCH_SIZE = 100;

function shouldScan(plan: string, lastScannedAt: Date | null): boolean {
  const interval = SCAN_INTERVAL_DAYS[plan] ?? 7;
  if (!lastScannedAt) return true;
  const elapsedMs = Date.now() - lastScannedAt.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return elapsedDays >= interval;
}

/**
 * Find all projects in batches and run a scan for each one (subject to per-plan
 * cadence). Projects are processed sequentially to avoid overwhelming Apify.
 * A failed scan for one project does not abort the rest.
 */
export async function runDailyScansForAllProjects(): Promise<DailyScanReport> {
  const report: DailyScanReport = {
    projectsScanned: 0,
    projectsSkipped: 0,
    errors: [],
  };

  let cursor: string | undefined = undefined;

  type ProjectBatch = Array<{
    id: string;
    brandName: string;
    lastScannedAt: Date | null;
    user: { plan: string };
  }>;

  while (true) {
    const batch: ProjectBatch = await prisma.project.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        brandName: true,
        lastScannedAt: true,
        user: { select: { plan: true } },
      },
      orderBy: { id: "asc" },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const project of batch) {
      const plan = project.user.plan;

      if (!shouldScan(plan, project.lastScannedAt)) {
        console.log(
          `[scheduler] Skip "${project.brandName}" (${project.id}) plan=${plan} — last scan ${project.lastScannedAt?.toISOString() ?? "never"}`
        );
        report.projectsSkipped++;
        continue;
      }

      try {
        console.log(
          `[scheduler] Running daily scan for "${project.brandName}" (${project.id}) plan=${plan}`
        );
        await runScan(project.id, plan);

        // Run social scanner for Growth+ projects
        if (plan === "GROWTH" || plan === "AGENCY" || plan === "ENTERPRISE") {
          try {
            const socialResults = await scanProject(project.id);
            console.log(
              `[scheduler] Social scan for ${project.id}: ` +
              `reddit=${socialResults.reddit} quora=${socialResults.quora} linkedin=${socialResults.linkedin}`
            );
          } catch (socialErr) {
            console.error(`[scheduler] Social scan failed for ${project.id}:`, socialErr);
          }
        }

        // Mark scan time (used by next-day skip check)
        await prisma.project.update({
          where: { id: project.id },
          data: { lastScannedAt: new Date() },
        });

        report.projectsScanned++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] Scan failed for project ${project.id}:`, message);
        report.errors.push({ projectId: project.id, error: message });
        report.projectsSkipped++;
      }
    }

    // If batch was smaller than BATCH_SIZE, we've reached the end
    if (batch.length < BATCH_SIZE) break;
  }

  console.log("[scheduler] Daily scan complete:", report);
  return report;
}
