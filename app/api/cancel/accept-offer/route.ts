/**
 * POST /api/cancel/accept-offer
 * Step 2: User accepted a save offer.
 * Applies Stripe discount / pause / credit and marks offer as accepted.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addMonths, format } from "date-fns";
import { sendCancellationOfferEmail } from "@/lib/email-cancel";

type OfferType = "discount" | "pause" | "free_month" | "competitor_intel";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    recordId: string;
    offerType: OfferType;
    // discount: (nothing extra)
    // pause: { months: 1 | 2 | 3 }
    pauseMonths?: number;
    // feature_request: { featureText: string }
    featureRequested?: string;
    // competitor: { competitorNamed: string; competitorFeedback?: string }
    competitorNamed?: string;
    competitorFeedback?: string;
  };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true, stripeSubscriptionId: true, plan: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const stripeKey = process.env.STRIPE_SECRET_KEY;

  // ── Apply the offer ──────────────────────────────────────────

  if (body.offerType === "discount" && stripeKey && user.stripeSubscriptionId) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey);

      // Create a 50% off coupon for 2 months
      const coupon = await stripe.coupons.create({
        percent_off: 50,
        duration: "repeating",
        duration_in_months: 2,
        name: "Save-the-churn 50%",
      });
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        coupon: coupon.id,
      });
    } catch (err) {
      console.error("[cancel/accept-offer] Stripe discount error:", err);
      // Still mark accepted — Stripe may not be configured in dev
    }
  }

  if (body.offerType === "pause") {
    const months = Math.min(3, Math.max(1, body.pauseMonths ?? 1));
    const pauseUntil = addMonths(new Date(), months);

    if (stripeKey && user.stripeSubscriptionId) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey);
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          pause_collection: { behavior: "void" },
        });
      } catch (err) {
        console.error("[cancel/accept-offer] Stripe pause error:", err);
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { pausedAt: new Date(), pauseUntil },
    });

    await prisma.cancellationRecord.update({
      where: { id: body.recordId },
      data: { offerAccepted: true, pauseDuration: body.pauseMonths ?? 1, cancelled: false },
    });

    // Send pause confirmation email
    await sendCancellationOfferEmail({
      to: user.email,
      name: user.name,
      type: "pause_confirmed",
      data: { pauseUntil: format(pauseUntil, "MMMM d, yyyy") },
    });

    return NextResponse.json({
      ok: true,
      message: `Your account is paused until ${format(pauseUntil, "MMMM d, yyyy")}. Resume anytime from Settings.`,
    });
  }

  if (body.offerType === "free_month" && stripeKey && user.stripeSubscriptionId) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey);

      // Add a 1-month free credit via a 100% coupon for 1 month
      const coupon = await stripe.coupons.create({
        percent_off: 100,
        duration: "once",
        name: "Feature-request 1 month free",
      });
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        coupon: coupon.id,
      });
    } catch (err) {
      console.error("[cancel/accept-offer] Stripe free month error:", err);
    }

    // Save feature request and notify admin
    if (body.featureRequested) {
      await notifyAdminFeatureRequest(user.email, body.featureRequested);
    }
  }

  if (body.offerType === "competitor_intel") {
    // No Stripe action — just save the intel
    await prisma.cancellationRecord.update({
      where: { id: body.recordId },
      data: {
        offerAccepted: false, // they're still cancelling
        competitorNamed: body.competitorNamed ?? null,
        featureRequested: body.competitorFeedback ?? null,
      },
    });
    return NextResponse.json({ ok: true, proceed: "cancel" });
  }

  // Mark offer accepted for all other offer types
  await prisma.cancellationRecord.update({
    where: { id: body.recordId },
    data: {
      offerAccepted: true,
      featureRequested: body.featureRequested ?? null,
      competitorNamed: body.competitorNamed ?? null,
      cancelled: false,
    },
  });

  return NextResponse.json({ ok: true });
}

async function notifyAdminFeatureRequest(userEmail: string, feature: string) {
  try {
    const { Resend } = await import("resend");
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    if (!resend || !process.env.ADMIN_NOTIFY_EMAIL) return;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@blockboost.co",
      to: process.env.ADMIN_NOTIFY_EMAIL,
      subject: `🔧 Feature request from cancelling user: ${userEmail}`,
      html: `<p><strong>User:</strong> ${userEmail}</p>
<p><strong>Feature requested:</strong></p>
<blockquote>${feature}</blockquote>
<p>They accepted 1 month free in exchange for this feedback.</p>`,
    });
  } catch (err) {
    console.error("[cancel] admin notify error:", err);
  }
}
