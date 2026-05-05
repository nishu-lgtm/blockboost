/**
 * POST /api/cancel/survey
 * Step 1: Receives the cancellation reason from the exit survey.
 * Creates a CancellationRecord, returns the offer type to show.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const OFFER_MAP: Record<string, string> = {
  too_expensive:       "discount",
  missing_feature:     "feature_request",
  not_enough_value:    "onboarding_call",
  found_alternative:   "competitor_intel",
  taking_a_break:      "pause",
  closing_business:    "export_data",
  too_complicated:     "export_data",
  other:               "simple",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    reason: string;
    otherText?: string;
  };

  if (!body.reason) {
    return NextResponse.json({ error: "reason required" }, { status: 400 });
  }

  const offerType = OFFER_MAP[body.reason] ?? "simple";

  // Create or update cancellation record (upsert by userId so re-entries refresh)
  const record = await prisma.cancellationRecord.create({
    data: {
      userId: session.user.id,
      reason: body.reason,
      otherText: body.otherText ?? null,
      offerShown: offerType,
      cancelled: false, // not yet confirmed
    },
  });

  return NextResponse.json({ offerType, recordId: record.id });
}
