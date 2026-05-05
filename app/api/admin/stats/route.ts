/**
 * GET /api/admin/stats
 * Returns overview dashboard data: MRR, users, trials, scans, errors, activity feed.
 */

import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, format } from "date-fns";

export const GET = adminRoute("VIEWER", async () => {
  const now = new Date();
  const today = startOfDay(now);
  const thirtyDaysAgo = subDays(now, 30);
  const sevenDaysAgo = subDays(now, 7);

  const [
    totalUsers,
    newUsersToday,
    totalScansToday,
    subscriptionEvents,
    recentMentions,
    recentUsers,
    recentSubscriptions,
  ] = await Promise.all([
    prisma.user.count({ where: { adminRole: "NONE" } }),
    prisma.user.count({ where: { createdAt: { gte: today }, adminRole: "NONE" } }),
    prisma.mention.count({ where: { createdAt: { gte: today } } }),
    prisma.subscriptionEvent.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { type: true, data: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.mention.findMany({
      where: { createdAt: { gte: today } },
      select: { mentionRank: true },
      take: 500,
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: today }, adminRole: "NONE" },
      select: { email: true, plan: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.subscriptionEvent.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { type: true, data: true, createdAt: true, user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // MRR calculation from subscription events
  const PLAN_MRR: Record<string, number> = { STARTER: 79, GROWTH: 299, ENTERPRISE: 999 };
  const activeSubs = await prisma.user.findMany({
    where: { plan: { not: "FREE" }, adminRole: "NONE" },
    select: { plan: true, createdAt: true },
  });
  const mrr = activeSubs.reduce((sum, u) => sum + (PLAN_MRR[u.plan] ?? 0), 0);

  // Trials — users on FREE plan who signed up in last 14 days
  const trialUsers = await prisma.user.findMany({
    where: {
      plan: "FREE",
      adminRole: "NONE",
      createdAt: { gte: subDays(now, 14) },
    },
    select: { createdAt: true },
  });
  const trialsEndingSoon = trialUsers.filter(
    (u) => subDays(now, 7) <= u.createdAt,
  ).length;

  // Signups by day (last 7 days)
  const signupsByDay = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const day = startOfDay(subDays(now, 6 - i));
      const nextDay = startOfDay(subDays(now, 5 - i));
      const count = await prisma.user.count({
        where: { createdAt: { gte: day, lt: nextDay }, adminRole: "NONE" },
      });
      return { date: format(day, "EEE"), count };
    }),
  );

  // Scans per day (last 7 days)
  const scansByDay = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const day = startOfDay(subDays(now, 6 - i));
      const nextDay = startOfDay(subDays(now, 5 - i));
      const count = await prisma.mention.count({
        where: { createdAt: { gte: day, lt: nextDay } },
      });
      return { date: format(day, "EEE"), count };
    }),
  );

  // Build activity feed
  const activity: Array<{ ts: string; type: string; message: string }> = [];

  for (const u of recentUsers) {
    activity.push({
      ts: u.createdAt.toISOString(),
      type: "signup",
      message: `${u.email} signed up (${u.plan} trial)`,
    });
  }
  for (const s of recentSubscriptions) {
    const data = s.data as Record<string, unknown>;
    activity.push({
      ts: s.createdAt.toISOString(),
      type: s.type.includes("cancel") ? "churn" : "payment",
      message: `${s.user?.email ?? "Unknown"} — ${s.type.replace(/_/g, " ")}${data.amount ? ` — $${data.amount}` : ""}`,
    });
  }
  activity.sort((a, b) => (a.ts < b.ts ? 1 : -1));

  // System status — basic connectivity checks (no external calls)
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

  return NextResponse.json({
    mrr,
    mrrPrevMonth: Math.round(mrr * 0.9), // stub — would need historical data
    totalUsers,
    newUsersToday,
    activeTrials: trialUsers.length,
    trialsEndingSoon,
    scansToday: totalScansToday,
    errorRate: 0.2, // stub — would come from error monitoring
    signupsByDay,
    scansByDay,
    activity: activity.slice(0, 20),
    systemStatus: {
      database: dbOk,
      email: !!process.env.RESEND_API_KEY,
      stripe: !!process.env.STRIPE_SECRET_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      apify: !!process.env.APIFY_API_TOKEN,
      blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    },
  });
});
