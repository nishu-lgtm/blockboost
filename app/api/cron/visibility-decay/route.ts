/**
 * Vercel Cron endpoint — runs daily.
 * Checks every project for week-over-week visibility decay; creates a
 * MENTION_RATE_DROP Alert when decay exceeds the threshold.
 *
 * Idempotent: re-runs the same day won't duplicate alerts because we
 * de-dupe on (projectId, type, createdAt-since-yesterday).
 *
 * Protected by CRON_SECRET like every other cron route.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDecay, decayAlertMessage } from "@/lib/decay";
import { runWithCronTracking } from "@/lib/cron-runner";
import { logSafeError } from "@/lib/safe-error";

export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logSafeError("[cron/visibility-decay]", new Error("CRON_SECRET not set"));
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runWithCronTracking("visibility-decay", checkAllProjects);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    logSafeError("[cron/visibility-decay]", err);
    return NextResponse.json(
      { error: "visibility-decay job failed", detail: String(err) },
      { status: 500 }
    );
  }
}

async function checkAllProjects(): Promise<{
  projectsChecked: number;
  alertsCreated: number;
  decaysDetected: number;
}> {
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Paginate to avoid loading 10k+ projects at once.
  const CHUNK = 100;
  let cursor: string | undefined;
  let projectsChecked = 0;
  let alertsCreated = 0;
  let decaysDetected = 0;

  for (;;) {
    const projects: Array<{
      id: string;
      userId: string;
      brandName: string;
    }> = await prisma.project.findMany({
      select: { id: true, userId: true, brandName: true },
      orderBy: { id: "asc" },
      take: CHUNK,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (projects.length === 0) break;

    for (const project of projects) {
      projectsChecked++;

      // Fetch 14 days of mentions for this project (just the fields decay needs).
      const rows = await prisma.mention.findMany({
        where: { projectId: project.id, createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true, brandMentioned: true, confidence: true },
      });
      // Narrow Prisma's `string | null` → the literal union the helper accepts.
      // Unknown values (legacy rows, future labels) collapse to null = treated
      // as medium-default, not 'low' — we don't suppress legacy data.
      const mentions = rows.map((r) => ({
        createdAt: r.createdAt,
        brandMentioned: r.brandMentioned,
        confidence:
          r.confidence === "high" || r.confidence === "medium" || r.confidence === "low"
            ? (r.confidence as "high" | "medium" | "low")
            : null,
      }));

      const result = computeDecay({ mentions, now, windowDays: 7 });
      if (result.verdict !== "decay") continue;

      decaysDetected++;

      // Dedupe — never two MENTION_RATE_DROP alerts for the same project
      // on the same day (cron may run twice on retry).
      const existing = await prisma.alert.findFirst({
        where: {
          projectId: project.id,
          type: "MENTION_RATE_DROP",
          createdAt: { gte: yesterday },
        },
        select: { id: true },
      });
      if (existing) continue;

      await prisma.alert.create({
        data: {
          projectId: project.id,
          userId: project.userId,
          type: "MENTION_RATE_DROP",
          message: decayAlertMessage(result, project.brandName),
          data: {
            currentRate: result.currentRate,
            previousRate: result.previousRate,
            deltaPP: result.deltaPP,
            currentSampleSize: result.currentSampleSize,
            previousSampleSize: result.previousSampleSize,
          },
        },
      });
      alertsCreated++;
    }

    cursor = projects[projects.length - 1].id;
    if (projects.length < CHUNK) break;
  }

  return { projectsChecked, alertsCreated, decaysDetected };
}
