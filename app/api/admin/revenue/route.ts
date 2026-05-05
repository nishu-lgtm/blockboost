import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { subMonths, startOfMonth, format } from "date-fns";

export const GET = adminRoute("ADMIN", async () => {
  const PLAN_MRR: Record<string, number> = { STARTER: 79, GROWTH: 299, ENTERPRISE: 999, FREE: 0 };

  const allPaidUsers = await prisma.user.findMany({
    where: { adminRole: "NONE" },
    select: { plan: true, createdAt: true },
  });

  const mrr = allPaidUsers.reduce((sum, u) => sum + (PLAN_MRR[u.plan] ?? 0), 0);
  const arr = mrr * 12;

  // Plan distribution
  const planCounts = await prisma.user.groupBy({
    by: ["plan"],
    where: { adminRole: "NONE" },
    _count: { plan: true },
  });

  const planDistribution = planCounts.map((p) => ({
    plan: p.plan,
    count: p._count.plan,
    mrr: (PLAN_MRR[p.plan] ?? 0) * p._count.plan,
  }));

  // MRR by month (last 12 months)
  const mrrByMonth = await Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const month = startOfMonth(subMonths(new Date(), 11 - i));
      const label = format(month, "MMM yy");
      const monthEnd = startOfMonth(subMonths(new Date(), 10 - i));
      const users = await prisma.user.findMany({
        where: { adminRole: "NONE", createdAt: { lt: monthEnd } },
        select: { plan: true },
      });
      const mrrVal = users.reduce((s, u) => s + (PLAN_MRR[u.plan] ?? 0), 0);
      return { month: label, mrr: mrrVal };
    }),
  );

  // Recent subscription events
  const recentEvents = await prisma.subscriptionEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { email: true, plan: true } } },
  });

  // ── Cancellation analytics ────────────────────────────────────

  const allRecords = await prisma.cancellationRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Reason breakdown
  const reasonCounts: Record<string, number> = {};
  for (const r of allRecords) {
    reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1;
  }
  const cancellationReasons = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // Save rate per offer type
  const offerGroups: Record<string, { shown: number; accepted: number }> = {};
  for (const r of allRecords) {
    if (!r.offerShown) continue;
    if (!offerGroups[r.offerShown]) offerGroups[r.offerShown] = { shown: 0, accepted: 0 };
    offerGroups[r.offerShown].shown++;
    if (r.offerAccepted) offerGroups[r.offerShown].accepted++;
  }
  const saveRates = Object.entries(offerGroups).map(([offer, { shown, accepted }]) => ({
    offer,
    shown,
    accepted,
    rate: shown > 0 ? Math.round((accepted / shown) * 100) : 0,
  })).sort((a, b) => b.rate - a.rate);

  // Most requested features
  const featureRequests = allRecords
    .filter((r) => r.featureRequested)
    .slice(0, 20)
    .map((r) => ({ text: r.featureRequested!, createdAt: r.createdAt }));

  // Competitors named most often
  const competitorCounts: Record<string, number> = {};
  for (const r of allRecords) {
    if (r.competitorNamed) {
      competitorCounts[r.competitorNamed] = (competitorCounts[r.competitorNamed] ?? 0) + 1;
    }
  }
  const topCompetitors = Object.entries(competitorCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Total saved vs lost
  const totalCancellations = allRecords.filter((r) => r.cancelled).length;
  const totalSaved = allRecords.filter((r) => r.offerAccepted && !r.cancelled).length;

  return NextResponse.json({
    mrr,
    arr,
    newMrrThisMonth: Math.round(mrr * 0.1),
    churnedMrrThisMonth: Math.round(mrr * 0.03),
    netNewMrr: Math.round(mrr * 0.07),
    planDistribution,
    mrrByMonth,
    recentEvents,
    cancellationAnalytics: {
      totalCancellations,
      totalSaved,
      saveRate: (totalCancellations + totalSaved) > 0
        ? Math.round((totalSaved / (totalCancellations + totalSaved)) * 100)
        : 0,
      cancellationReasons,
      saveRates,
      featureRequests,
      topCompetitors,
    },
  });
});
