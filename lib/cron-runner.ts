/**
 * Wraps a cron job in a try/finally that records run history into the CronRun
 * table. Read back by /api/admin/health for real metrics.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function runWithCronTracking<T>(
  name: string,
  job: () => Promise<T>,
  metadata?: Prisma.InputJsonValue
): Promise<T> {
  const run = await prisma.cronRun.create({
    data: { name, status: "running", metadata: metadata ?? {} },
  });
  const startedAt = run.startedAt.getTime();

  try {
    const result = await job();
    const resultJson: Prisma.InputJsonValue =
      result && typeof result === "object"
        ? (JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue)
        : (metadata ?? {});
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        metadata: resultJson,
      },
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        error: message.slice(0, 2000),
      },
    });
    throw err;
  }
}
