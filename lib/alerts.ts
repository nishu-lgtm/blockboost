/**
 * Alert creation helper.
 * Persists to DB, then dispatches email and/or Slack based on user preferences.
 */

import { prisma } from "@/lib/prisma";
import { AlertType, Prisma } from "@prisma/client";
import { sendAlertEmail } from "@/lib/email";
import { postToSlack } from "@/lib/slack";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateAlertOptions {
  projectId: string;
  userId: string;
  type: AlertType;
  message: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Create an alert and dispatch notifications
// ---------------------------------------------------------------------------

export async function createAlert(opts: CreateAlertOptions): Promise<void> {
  const { projectId, userId, type, message, data = {} } = opts;

  // 1. Persist the alert
  await prisma.alert.create({
    data: {
      projectId,
      userId,
      type,
      message,
      data: data as Prisma.InputJsonValue,
    },
  });

  // 2. Fetch user preferences (email, Slack) + project brand name
  const [user, project] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailNotifications: true,
        slackWebhookUrl: true,
        slackConnected: true,
      },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { brandName: true },
    }),
  ]);

  if (!user) return;

  const brandName = project?.brandName ?? "Your brand";

  // 3. Email — skip SCAN_COMPLETE (sent separately by weekly cron to avoid noise)
  if (user.emailNotifications && user.email && type !== AlertType.SCAN_COMPLETE) {
    sendAlertEmail({
      to: user.email,
      brandName,
      alertType: type,
      message,
      data,
    }).catch((err) => {
      console.error("[alerts] Failed to send alert email:", err);
    });
  }

  // 4. Slack
  if (user.slackConnected && user.slackWebhookUrl) {
    postToSlack(user.slackWebhookUrl, {
      type,
      message,
      data,
      brandName,
      projectId,
    }).catch((err) => {
      console.error("[alerts] Failed to post Slack message:", err);
    });
  }
}

// ---------------------------------------------------------------------------
// Convenience creators for each alert type
// ---------------------------------------------------------------------------

export function createScanCompleteAlert(
  projectId: string,
  userId: string,
  summary: {
    mentionRate: number;
    citationsFound: number;
    mentionsCreated: number;
    totalPrompts: number;
    platforms: number;
  }
) {
  return createAlert({
    projectId,
    userId,
    type: AlertType.SCAN_COMPLETE,
    message: `Scan finished: ${summary.mentionRate}% overall mention rate across ${summary.platforms} platform${summary.platforms !== 1 ? "s" : ""} (${summary.totalPrompts} prompts)`,
    data: summary,
  });
}

export function createMentionRateDropAlert(
  projectId: string,
  userId: string,
  previousRate: number,
  currentRate: number
) {
  const drop = previousRate - currentRate;
  return createAlert({
    projectId,
    userId,
    type: AlertType.MENTION_RATE_DROP,
    message: `Your overall AI mention rate dropped by ${drop} percentage points (${previousRate}% → ${currentRate}%).`,
    data: { previousRate, currentRate, drop },
  });
}

export function createCompetitorSurgeAlert(
  projectId: string,
  userId: string,
  competitorName: string,
  previousRate: number,
  currentRate: number
) {
  const increase = currentRate - previousRate;
  return createAlert({
    projectId,
    userId,
    type: AlertType.COMPETITOR_SURGE,
    message: `${competitorName}'s AI mention rate jumped by ${increase} percentage points (${previousRate}% → ${currentRate}%). Monitor their content strategy.`,
    data: { competitorName, previousRate, currentRate, increase },
  });
}

export function createNewCitationAlert(
  projectId: string,
  userId: string,
  domain: string,
  platform: string
) {
  return createAlert({
    projectId,
    userId,
    type: AlertType.NEW_CITATION,
    message: `A new domain (${domain}) is citing your brand in ${platform} AI responses.`,
    data: { domain, platform },
  });
}
