import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const POST = adminRoute("SUPPORT", async (req: NextRequest, { admin, params }) => {
  const { id } = await params!;
  const { amount, reason } = (await req.json()) as { amount: number; reason?: string };

  const user = await prisma.user.findUnique({
    where: { id },
    select: { stripeCustomerId: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Issue Stripe refund if configured
  if (process.env.STRIPE_SECRET_KEY && user.stripeCustomerId) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      // Find latest charge for this customer
      const charges = await stripe.charges.list({ customer: user.stripeCustomerId, limit: 1 });
      const charge = charges.data[0];
      if (charge) {
        await stripe.refunds.create({
          charge: charge.id,
          amount: Math.round(amount * 100),
        });
      }
    } catch (err) {
      console.error("[admin/refund] Stripe error:", err);
    }
  }

  await logAudit({
    adminUserId: admin.id,
    action: "ISSUE_REFUND",
    targetType: "user",
    targetId: id,
    details: { amount, reason, userEmail: user.email },
  });

  return NextResponse.json({ ok: true });
});
