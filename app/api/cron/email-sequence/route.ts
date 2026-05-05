/**
 * GET /api/cron/email-sequence
 * Runs hourly (see vercel.json).
 * Processes ScheduledEmail rows whose sendAt has passed.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateTrackingId,
  generateUnsubscribeToken,
  renderEmail,
} from "@/lib/email-renderer";
import { sendEmail } from "@/lib/email-triggers";
import React from "react";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Fetch up to 50 due scheduled emails (basic fields only)
  const due = await prisma.scheduledEmail.findMany({
    where: {
      sendAt: { lte: now },
      sentAt: null,
      cancelled: false,
    },
    take: 50,
    orderBy: { sendAt: "asc" },
  });

  const results: { id: string; step: string; status: string }[] = [];

  for (const scheduled of due) {
    const { userId, sequence, step, id } = scheduled;

    // Fetch user + activation state separately for each email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        activationState: true,
        projects: {
          take: 1,
          include: {
            competitors: {
              take: 1,
              select: { id: true, brandName: true },
            },
            contentBriefs: {
              take: 1,
              select: { id: true },
            },
            mentions: {
              orderBy: { createdAt: "desc" },
              take: 30,
              select: { brandMentioned: true },
            },
          },
        },
      },
    });

    if (!user?.email) {
      await prisma.scheduledEmail.update({ where: { id }, data: { cancelled: true } });
      results.push({ id, step, status: "no-email" });
      continue;
    }

    const firstName = (user.name ?? "there").split(" ")[0];
    const unsubscribeToken = generateUnsubscribeToken(user.id);
    const trackingId = generateTrackingId();

    // Compute mention rate from recent mentions
    const project = user.projects?.[0];
    const mentions = project?.mentions ?? [];
    const mentionRate = mentions.length > 0
      ? Math.round((mentions.filter((m) => m.brandMentioned).length / mentions.length) * 100)
      : 0;
    const hasCompetitor = (project?.competitors?.length ?? 0) > 0;
    const competitorName = project?.competitors?.[0]?.brandName ?? "your top competitor";
    const hasBrief = (project?.contentBriefs?.length ?? 0) > 0;
    const state = user.activationState;

    try {
      let html = "";
      let subject = "";
      let emailType: "tips" | "billing" | "weeklyReport" = "tips";

      if (sequence === "trial") {
        ({ html, subject, emailType } = await buildTrialEmail({
          step, firstName, userId: user.id, user,
          mentionRate, hasCompetitor, competitorName, hasBrief,
          state, trackingId, unsubscribeToken,
        }));
      } else if (sequence === "paid") {
        ({ html, subject, emailType } = await buildPaidEmail({
          step, firstName, userId: user.id,
          mentionRate, competitorName, state,
          trackingId, unsubscribeToken,
        }));
      }

      if (!html) {
        await prisma.scheduledEmail.update({ where: { id }, data: { cancelled: true } });
        results.push({ id, step, status: "skipped" });
        continue;
      }

      await sendEmail({
        userId: user.id,
        to: user.email,
        subject,
        sequence,
        step,
        html,
        emailType,
      });

      await prisma.scheduledEmail.update({
        where: { id },
        data: { sentAt: now },
      });

      results.push({ id, step, status: "sent" });
    } catch (err) {
      console.error(`[email-sequence cron] Error processing ${id}:`, err);
      results.push({ id, step, status: "error" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

// ─── Trial sequence builder ───────────────────────────────────────────────────

interface TrialEmailArgs {
  step: string;
  firstName: string;
  userId: string;
  user: { plan: string };
  mentionRate: number;
  hasCompetitor: boolean;
  competitorName: string;
  hasBrief: boolean;
  state: {
    generatedBrief: Date | null;
    connectedGSC: Date | null;
    generatedReport?: Date | null;
  } | null;
  trackingId: string;
  unsubscribeToken: string;
}

async function buildTrialEmail(
  args: TrialEmailArgs
): Promise<{ html: string; subject: string; emailType: "tips" | "billing" | "weeklyReport" }> {
  const { step, firstName, userId, user, mentionRate, hasCompetitor, competitorName, hasBrief, state, trackingId, unsubscribeToken } = args;

  switch (step) {
    case "A3": {
      if (hasCompetitor) return skip();
      const { default: A3 } = await import("@/emails/A3-competitor-nudge");
      return {
        subject: "Are your competitors already ahead of you in AI? 🔍",
        emailType: "tips",
        html: await renderEmail(React.createElement(A3, { firstName, userId, unsubscribeToken, trackingId })),
      };
    }

    case "A4": {
      if (hasCompetitor) {
        const { default: A4 } = await import("@/emails/A4-comparison");
        return {
          subject: `How you compare to ${competitorName} in AI`,
          emailType: "tips",
          html: await renderEmail(React.createElement(A4, {
            firstName,
            yourMentionRate: mentionRate,
            competitorName,
            competitorMentionRate: 0,
            gapPrompts: [],
            userId,
            unsubscribeToken,
            trackingId,
          })),
        };
      } else {
        const { default: A4b } = await import("@/emails/A4b-no-competitor");
        return {
          subject: "What are you missing without competitor tracking?",
          emailType: "tips",
          html: await renderEmail(React.createElement(A4b, { firstName, userId, unsubscribeToken, trackingId })),
        };
      }
    }

    case "A5": {
      if (state?.generatedBrief) return skip();
      const { default: A5 } = await import("@/emails/A5-brief");
      return {
        subject: "The 5-minute content fix that gets you into AI answers",
        emailType: "tips",
        html: await renderEmail(React.createElement(A5, { firstName, gapCount: 7, userId, unsubscribeToken, trackingId })),
      };
    }

    case "A6": {
      const { default: A6 } = await import("@/emails/A6-weekly");
      return {
        subject: "Your first BlockBoost weekly report",
        emailType: "weeklyReport",
        html: await renderEmail(React.createElement(A6, {
          firstName,
          weekData: {
            mentionRate,
            mentionRatePrev: 0,
            totalScans: 1,
            topPlatform: "ChatGPT",
            topActions: [
              "Add 2 competitors to unlock comparison data",
              "Generate your first content brief",
              "Connect Google Search Console for deeper insights",
            ],
            setupStepsComplete: (hasCompetitor ? 1 : 0) + (hasBrief ? 1 : 0) + (state?.connectedGSC ? 1 : 0) + 2,
          },
          userId,
          unsubscribeToken,
          trackingId,
        })),
      };
    }

    case "A7": {
      if (state?.connectedGSC) return skip();
      const { default: A7 } = await import("@/emails/A7-gsc");
      return {
        subject: "Unlock 50 more tracking prompts — free",
        emailType: "tips",
        html: await renderEmail(React.createElement(A7, { firstName, userId, unsubscribeToken, trackingId })),
      };
    }

    case "A8": {
      if (user.plan !== "FREE") return skip();
      const { default: A8 } = await import("@/emails/A8-trial-ending");
      return {
        subject: "Your free trial ends in 3 days",
        emailType: "billing",
        html: await renderEmail(React.createElement(A8, {
          firstName,
          scansRun: 3,
          mentionRate,
          competitorCount: hasCompetitor ? 1 : 0,
          topInsight: `You appear in ChatGPT for ${mentionRate}% of your tracked searches`,
          trialEndDate: "in 3 days",
          userId,
          unsubscribeToken,
          trackingId,
        })),
      };
    }

    case "A9": {
      if (user.plan !== "FREE") return skip();
      const { default: A9 } = await import("@/emails/A9-last-day");
      return {
        subject: "Last day of your free trial ⏰",
        emailType: "billing",
        html: await renderEmail(React.createElement(A9, {
          firstName,
          promptCount: 10,
          competitorCount: hasCompetitor ? 1 : 0,
          briefCount: hasBrief ? 1 : 0,
          userId,
          unsubscribeToken,
          trackingId,
        })),
      };
    }

    case "A10": {
      if (user.plan !== "FREE") return skip();
      const { default: A10 } = await import("@/emails/A10-trial-ended");
      return {
        subject: "Your BlockBoost trial has ended",
        emailType: "billing",
        html: await renderEmail(React.createElement(A10, {
          firstName,
          discountCode: "WELCOME30",
          expiresIn: "48 hours",
          userId,
          unsubscribeToken,
          trackingId,
        })),
      };
    }

    default:
      return skip();
  }
}

// ─── Paid sequence builder ────────────────────────────────────────────────────

interface PaidEmailArgs {
  step: string;
  firstName: string;
  userId: string;
  mentionRate: number;
  competitorName: string;
  state: { generatedReport?: Date | null } | null;
  trackingId: string;
  unsubscribeToken: string;
}

async function buildPaidEmail(
  args: PaidEmailArgs
): Promise<{ html: string; subject: string; emailType: "tips" | "billing" | "weeklyReport" }> {
  const { step, firstName, userId, mentionRate, competitorName, state, trackingId, unsubscribeToken } = args;

  switch (step) {
    case "B2": {
      if (state?.generatedReport) return skip();
      const { default: B2 } = await import("@/emails/B2-report");
      return {
        subject: "Your AI visibility report is ready to generate",
        emailType: "weeklyReport",
        html: await renderEmail(React.createElement(B2, {
          firstName,
          daysSincePaid: 21,
          mentionRate,
          topCompetitorName: competitorName,
          topCompetitorRate: 0,
          userId,
          unsubscribeToken,
          trackingId,
        })),
      };
    }

    case "B4": {
      const { default: B4 } = await import("@/emails/B4-nps");
      return {
        subject: "Quick question — how likely are you to recommend us?",
        emailType: "tips",
        html: await renderEmail(React.createElement(B4, { firstName, userId, unsubscribeToken, trackingId })),
      };
    }

    case "B5": {
      const { default: B5 } = await import("@/emails/B5-reengagement");
      return {
        subject: "You haven't logged in — here's what you missed",
        emailType: "tips",
        html: await renderEmail(React.createElement(B5, {
          firstName,
          daysSinceLastLogin: 60,
          mentionRate,
          topCompetitorName: competitorName,
          topCompetitorRate: 0,
          missedScans: 8,
          userId,
          unsubscribeToken,
          trackingId,
        })),
      };
    }

    default:
      return skip();
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function skip(): { html: string; subject: string; emailType: "tips" } {
  return { html: "", subject: "", emailType: "tips" };
}
