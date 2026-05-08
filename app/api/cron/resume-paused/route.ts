/**
 * GET /api/cron/resume-paused
 * Runs daily. Finds users whose pauseUntil date has passed and resumes their Stripe subscription.
 * Triggered by Vercel Cron (see vercel.json).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { sendCancellationOfferEmail } from "@/lib/email-cancel";

export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronRun = await prisma.cronRun.create({
    data: { name: "resume-paused", status: "running" },
  });
  const startMs = cronRun.startedAt.getTime();

  try {
    const result = await runResumePaused();
    await prisma.cronRun.update({
      where: { id: cronRun.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        durationMs: Date.now() - startMs,
        metadata: result as unknown as object,
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.cronRun.update({
      where: { id: cronRun.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        durationMs: Date.now() - startMs,
        error: message.slice(0, 2000),
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runResumePaused() {
  const now = new Date();

  // Find paused users whose pause period has ended
  const expiredPauses = await prisma.user.findMany({
    where: {
      pauseUntil: { lte: now },
      pausedAt: { not: null },
    },
    select: {
      id: true,
      email: true,
      name: true,
      stripeSubscriptionId: true,
      pauseUntil: true,
    },
  });

  let resumed = 0;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  for (const user of expiredPauses) {
    try {
      // Resume Stripe subscription
      if (stripeKey && user.stripeSubscriptionId) {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey);
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          pause_collection: "",
        });
      }

      // Clear pause fields
      await prisma.user.update({
        where: { id: user.id },
        data: { pausedAt: null, pauseUntil: null },
      });

      // Send resume notification
      await sendCancellationOfferEmail({
        to: user.email,
        name: user.name,
        type: "resumed",
        data: { resumedDate: format(now, "MMMM d, yyyy") },
      });

      resumed++;
    } catch (err) {
      console.error(`[resume-paused] Failed for user ${user.id}:`, err);
    }
  }

  // Win-back Day 30 emails
  // FIX #30: Was using a ±1h window — if the cron ever missed a day, those users
  // would never get the email. Now we use `lte: thirtyDaysAgo` and dedupe via the
  // `winback30SentAt` flag on CancellationRecord (added in this fix).
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const day30Users = await prisma.cancellationRecord.findMany({
    where: {
      cancelled: true,
      createdAt: { lte: thirtyDaysAgo },
      winback30SentAt: null,
    },
    include: { user: { select: { email: true, name: true } } },
    distinct: ["userId"],
  });

  for (const record of day30Users) {
    try {
      await sendCancellationOfferEmail({
        to: record.user.email,
        name: record.user.name,
        type: "winback_day30",
        data: { reason: record.reason },
      });
      await prisma.cancellationRecord.update({
        where: { id: record.id },
        data: { winback30SentAt: new Date() },
      });
    } catch (err) {
      console.error(`[resume-paused] Day30 winback failed for ${record.userId}:`, err);
    }
  }

  // Win-back Day 90 emails (with 40% off coupon) — same dedupe pattern via winback90SentAt
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const day90Users = await prisma.cancellationRecord.findMany({
    where: {
      cancelled: true,
      wantWinback: true,
      createdAt: { lte: ninetyDaysAgo },
      winback90SentAt: null,
    },
    include: { user: { select: { email: true, name: true, stripeCustomerId: true } } },
    distinct: ["userId"],
  });

  for (const record of day90Users) {
    try {
      // Create a 40% off coupon expiring in 7 days
      let couponCode = "";
      if (stripeKey) {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey);
        const coupon = await stripe.coupons.create({
          percent_off: 40,
          duration: "once",
          redeem_by: Math.floor((now.getTime() + 7 * 24 * 60 * 60 * 1000) / 1000),
          name: "Win-back 40%",
        });
        couponCode = coupon.id;
      }

      await sendCancellationOfferEmail({
        to: record.user.email,
        name: record.user.name,
        type: "winback_day90",
        data: {
          couponCode,
          expiresDate: format(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), "MMMM d, yyyy"),
        },
      });
      await prisma.cancellationRecord.update({
        where: { id: record.id },
        data: { winback90SentAt: new Date() },
      });
    } catch (err) {
      console.error(`[resume-paused] Day90 winback failed for ${record.userId}:`, err);
    }
  }

  return {
    resumed,
    winback30Sent: day30Users.length,
    winback90Sent: day90Users.length,
  };
}
