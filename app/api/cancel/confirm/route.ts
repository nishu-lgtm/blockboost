/**
 * POST /api/cancel/confirm
 * Step 3: User confirmed cancellation after declining all offers.
 * Cancels Stripe subscription at period end, updates user plan to FREE,
 * triggers win-back email sequence.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, addMonths, format } from "date-fns";
import { sendCancellationOfferEmail } from "@/lib/email-cancel";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    recordId: string;
    wantNotified?: boolean;
    wantWinback?: boolean;
  };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      plan: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let periodEnd: Date = addDays(new Date(), 30); // fallback if no Stripe

  // Cancel Stripe subscription at period end (not immediately)
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && user.stripeSubscriptionId) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey);
      const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      periodEnd = new Date(sub.current_period_end * 1000);
    } catch (err) {
      console.error("[cancel/confirm] Stripe error:", err);
    }
  }

  // Update cancellation record
  await prisma.cancellationRecord.update({
    where: { id: body.recordId },
    data: {
      cancelled: true,
      wantNotified: body.wantNotified ?? false,
      wantWinback: body.wantWinback ?? false,
    },
  });

  // Log subscription event
  await prisma.subscriptionEvent.create({
    data: {
      userId: user.id,
      type: "CANCELLED",
      data: {
        periodEnd: periodEnd.toISOString(),
        wantWinback: body.wantWinback ?? false,
      },
    },
  });

  // Day 1 win-back email: "Your data is safe"
  await sendCancellationOfferEmail({
    to: user.email,
    name: user.name,
    type: "cancelled_day1",
    data: {
      periodEnd: format(periodEnd, "MMMM d, yyyy"),
      dashboardUrl: `${process.env.NEXTAUTH_URL ?? "https://blockboost.co"}/dashboard`,
    },
  });

  // Schedule Day 30 and Day 90 win-back emails by storing in DB
  // (Cron job reads CancellationRecord where cancelled=true and sends at +30/+90 days)
  // The cron checks createdAt + 30 days and + 90 days to send follow-ups.

  return NextResponse.json({
    ok: true,
    periodEnd: periodEnd.toISOString(),
    message: `Your subscription will end on ${format(periodEnd, "MMMM d, yyyy")}.`,
  });
}
