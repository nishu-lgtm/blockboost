/**
 * POST /api/admin/backfill-intent
 *
 * Classifies every Prompt row where `intent IS NULL` and writes the result.
 * Idempotent — re-runnable safely; already-classified rows are skipped.
 *
 * Admin-only one-off migration step (Sprint 1 step 3). Once every existing
 * Prompt has an intent, this route is dead weight and can be deleted.
 *
 * The classifier itself is pure / deterministic / no LLM — runs fast even
 * on tens of thousands of rows. We chunk writes to avoid loading everything
 * into memory.
 */
import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { classifyIntent } from "@/lib/query-intent";

export const POST = adminRoute("SUPPORT", async () => {
  const CHUNK = 500;
  let processed = 0;
  let updated = 0;

  // Loop until no NULL-intent rows remain. Each iteration fetches a chunk,
  // classifies in JS, writes via parallel updates. No cursor needed because
  // each iteration mutates the WHERE-clause population.
  // Cap loops at 200 (100k rows) to avoid runaway if classifier ever returns null.
  for (let loop = 0; loop < 200; loop++) {
    const batch = await prisma.prompt.findMany({
      where: { intent: null },
      select: { id: true, text: true },
      take: CHUNK,
    });
    if (batch.length === 0) break;

    await Promise.all(
      batch.map((p) =>
        prisma.prompt.update({
          where: { id: p.id },
          data: { intent: classifyIntent(p.text) },
        })
      )
    );

    processed += batch.length;
    updated += batch.length;
    if (batch.length < CHUNK) break;
  }

  return NextResponse.json({ ok: true, processed, updated });
});
