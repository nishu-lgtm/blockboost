/**
 * GET /api/admin/users/[id]
 * Full user profile for admin — projects, usage, subscription history, notes.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const GET = adminRoute(
  "VIEWER",
  async (req: NextRequest, { admin, params }) => {
    const { id } = await params!;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            _count: {
              select: { mentions: true, competitors: true, prompts: true },
            },
          },
        },
        subscriptionEvents: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        reports: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, createdAt: true, reportType: true, pdfUrl: true },
        },
        adminNotesAbout: {
          orderBy: { createdAt: "desc" },
          include: { admin: { select: { name: true, email: true } } },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Count total mentions across all projects
    const totalMentions = await prisma.mention.count({
      where: { projectId: { in: user.projects.map((p) => p.id) } },
    });
    const totalCitations = await prisma.citation.count({
      where: { projectId: { in: user.projects.map((p) => p.id) } },
    });

    // Scan history (last 10 scan events = groups of mentions by date)
    const recentMentions = await prisma.mention.findMany({
      where: { projectId: { in: user.projects.map((p) => p.id) } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { createdAt: true, platform: true, brandMentioned: true },
    });

    await logAudit({
      adminUserId: admin.id,
      action: "VIEW_USER",
      targetType: "user",
      targetId: id,
    });

    const PLAN_MRR: Record<string, number> = { STARTER: 79, GROWTH: 299, ENTERPRISE: 999, FREE: 0 };
    const lifetimeRevenue = user.subscriptionEvents
      .filter((e) => e.type === "payment_succeeded")
      .reduce((sum, e) => {
        const data = e.data as Record<string, unknown>;
        return sum + (typeof data.amount === "number" ? data.amount / 100 : 0);
      }, 0);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        plan: user.plan,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        adminBanned: user.adminBanned,
        adminBanReason: user.adminBanReason,
        emailNotifications: user.emailNotifications,
        gscConnected: user.gscConnected,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        mrr: PLAN_MRR[user.plan] ?? 0,
        lifetimeRevenue,
      },
      projects: user.projects.map((p) => ({
        id: p.id,
        name: p.name,
        brandName: p.brandName,
        websiteUrl: p.websiteUrl,
        mentions: p._count.mentions,
        competitors: p._count.competitors,
        prompts: p._count.prompts,
        createdAt: p.createdAt,
      })),
      usage: {
        totalMentions,
        totalCitations,
        totalReports: user.reports.length,
      },
      subscriptionHistory: user.subscriptionEvents,
      recentMentions: recentMentions.slice(0, 20),
      notes: user.adminNotesAbout,
    });
  },
);
