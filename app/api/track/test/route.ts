/**
 * POST /api/track/test
 *
 * Authenticated. Inserts one synthetic GPTBot visit for the user's first
 * project so they can verify their snippet is wired up correctly without
 * waiting for a real crawler. Uses the same dedupeKey logic as the live
 * ingest, so clicking more than once per day is a no-op.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDedupeKey } from "@/lib/bot-detector";
import { logSafeError } from "@/lib/safe-error";

const TEST_BOT_NAME = "GPTBot";
const TEST_URL = "https://blockboost-snippet-test.local/verify";
const TEST_UA = "GPTBot/1.1 (https://openai.com/gptbot) [BlockBoost snippet test]";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (!project) {
      return NextResponse.json({ error: "No project found" }, { status: 404 });
    }

    const dedupeKey = buildDedupeKey({
      projectId: project.id,
      botName: TEST_BOT_NAME,
      url: TEST_URL,
    });

    await prisma.aiBotVisit.createMany({
      data: [
        {
          projectId: project.id,
          botName: TEST_BOT_NAME,
          userAgent: TEST_UA,
          url: TEST_URL,
          dedupeKey,
        },
      ],
      skipDuplicates: true,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logSafeError("[track/test] insert failed", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
