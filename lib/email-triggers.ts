/**
 * Email trigger system for BlockBoost activation sequences.
 *
 * Two sequences:
 *   A — Trial onboarding (A1–A10)
 *   B — Paid retention (B1–B5)
 *
 * Call the event hooks from the relevant API routes.
 * The cron /api/cron/email-sequence flushes ScheduledEmail rows every hour.
 */

import { prisma } from "@/lib/prisma";
import { generateTrackingId, generateUnsubscribeToken } from "@/lib/email-renderer";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";
const FROM = process.env.EMAIL_FROM ?? "Tom from BlockBoost <tom@blockboost.co>";

/**
 * Compute the next 9am send time, daysFromNow days in the future.
 * If that 9am has already passed today, push to the following day's 9am.
 * Used to align scheduled emails with the daily 9am cron.
 */
function nextSendTime(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(9, 0, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EmailType = "tips" | "billing" | "weeklyReport" | "monthlySummary" | "alerts";

interface SendOptions {
  userId: string;
  to: string;
  subject: string;
  sequence: string;
  step: string;
  html: string;
  emailType: EmailType;
  trackingId?: string;
}

// ─── Core send helper ─────────────────────────────────────────────────────────

export async function sendEmail(opts: SendOptions): Promise<void> {
  const { userId, to, subject, sequence, step, html } = opts;

  // Check if already sent
  const already = await prisma.emailSent.findFirst({
    where: { userId, sequence, step },
  });
  if (already) return;

  // Check user email preference for this type
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      emailPrefWeeklyReport: true,
      emailPrefMonthlySummary: true,
      emailPrefFeatureNews: true,
      emailPrefAlerts: true,
      emailPrefTips: true,
    },
  });
  if (!user) return;

  // Billing emails are always sent; others respect prefs
  const blocked =
    (opts.emailType === "weeklyReport" && !user.emailPrefWeeklyReport) ||
    (opts.emailType === "monthlySummary" && !user.emailPrefMonthlySummary) ||
    (opts.emailType === "tips" && !user.emailPrefTips) ||
    (opts.emailType === "alerts" && !user.emailPrefAlerts);
  if (blocked) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    const messageId =
      result && typeof result === "object" && "data" in result
        ? (result as { data?: { id?: string } }).data?.id
        : undefined;

    await prisma.emailSent.create({
      data: {
        userId,
        sequence,
        step,
        subject,
        resendMessageId: messageId ?? null,
        trackingId: opts.trackingId ?? null,
      },
    });
  } catch (err) {
    console.error(`[email-triggers] Failed to send ${sequence}/${step} to ${userId}:`, err);
  }
}

// ─── Schedule helper ──────────────────────────────────────────────────────────

export async function scheduleEmail(
  userId: string,
  sequence: string,
  step: string,
  sendAt: Date
): Promise<void> {
  // Don't double-schedule
  const exists = await prisma.scheduledEmail.findFirst({
    where: { userId, sequence, step, cancelled: false },
  });
  if (exists) return;

  await prisma.scheduledEmail.create({
    data: { userId, sequence, step, sendAt },
  });
}

/** Cancel all pending scheduled emails for a user in a sequence */
export async function cancelSequence(
  userId: string,
  sequence: string
): Promise<void> {
  await prisma.scheduledEmail.updateMany({
    where: { userId, sequence, sentAt: null, cancelled: false },
    data: { cancelled: true },
  });
}

// ─── Activation state helpers ─────────────────────────────────────────────────

async function getOrCreateActivationState(userId: string) {
  const existing = await prisma.userActivationState.findUnique({
    where: { userId },
  });
  if (existing) return existing;
  return prisma.userActivationState.create({
    data: { userId, signedUp: new Date() },
  });
}

// ─── Template builders ────────────────────────────────────────────────────────

async function buildAndSend(
  userId: string,
  email: string,
  sequence: string,
  step: string,
  subject: string,
  emailType: EmailType,
  buildHtml: (trackingId: string, unsubscribeToken: string) => Promise<string>
): Promise<void> {
  const trackingId = generateTrackingId();
  const unsubscribeToken = generateUnsubscribeToken(userId);
  const html = await buildHtml(trackingId, unsubscribeToken);
  await sendEmail({ userId, to: email, subject, sequence, step, html, emailType, trackingId });
}

// ─── Event hooks ─────────────────────────────────────────────────────────────

/**
 * Called immediately after user registers (email or OAuth).
 * Sends A1 now and schedules A2–A10.
 */
export async function onUserSignup(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  const firstName = (user.name ?? "there").split(" ")[0];
  await getOrCreateActivationState(userId);

  // A1 — immediate
  await buildAndSend(userId, user.email, "trial", "A1", "Welcome to BlockBoost 👋", "tips",
    async (trackingId, unsubscribeToken) => {
      const { default: A1 } = await import("@/emails/A1-welcome");
      const React = await import("react");
      const { renderEmail } = await import("@/lib/email-renderer");
      return renderEmail(React.createElement(A1, { firstName, userId, unsubscribeToken, trackingId }));
    }
  );

  // Schedule the rest — all aligned to 9am cron
  await scheduleEmail(userId, "trial", "A2", nextSendTime(0));   // tomorrow 9am — score ready
  await scheduleEmail(userId, "trial", "A3", nextSendTime(2));   // day 2 — competitor nudge
  await scheduleEmail(userId, "trial", "A4", nextSendTime(3));   // day 3 — comparison or no-competitor
  await scheduleEmail(userId, "trial", "A5", nextSendTime(5));   // day 5 — brief
  await scheduleEmail(userId, "trial", "A6", nextSendTime(7));   // day 7 — weekly
  await scheduleEmail(userId, "trial", "A7", nextSendTime(10));  // day 10 — GSC
  await scheduleEmail(userId, "trial", "A8", nextSendTime(11));  // day 11 — trial ending
  await scheduleEmail(userId, "trial", "A9", nextSendTime(13));  // day 13 — last day
  await scheduleEmail(userId, "trial", "A10", nextSendTime(14)); // day 14 — trial ended
}

/**
 * Called when the first scan completes for a user.
 * Triggers A2 (score reveal) immediately.
 */
export async function onFirstScanComplete(
  userId: string,
  mentionRate: number,
  topOpportunity: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  const firstName = (user.name ?? "there").split(" ")[0];

  // Mark activation state
  await prisma.userActivationState.upsert({
    where: { userId },
    create: { userId, ranFirstScan: new Date() },
    update: { ranFirstScan: new Date() },
  });

  // Cancel scheduled A2, send immediately instead
  await prisma.scheduledEmail.updateMany({
    where: { userId, sequence: "trial", step: "A2", sentAt: null, cancelled: false },
    data: { cancelled: true },
  });

  await buildAndSend(userId, user.email, "trial", "A2",
    `Your AI visibility score is ${mentionRate}%`,
    "tips",
    async (trackingId, unsubscribeToken) => {
      const { default: A2 } = await import("@/emails/A2-score");
      const React = await import("react");
      const { renderEmail } = await import("@/lib/email-renderer");
      return renderEmail(React.createElement(A2, {
        firstName,
        score: mentionRate,
        topOpportunity,
        topAction: "Generate your first content brief",
        userId,
        unsubscribeToken,
        trackingId,
      }));
    }
  );
}

/**
 * Called when a competitor is added for the first time.
 * Marks activation state; the cron will pick up A4 (comparison) over A4b.
 */
export async function onCompetitorAdded(userId: string): Promise<void> {
  const state = await prisma.userActivationState.findUnique({ where: { userId } });
  if (!state?.addedCompetitor) {
    await prisma.userActivationState.upsert({
      where: { userId },
      create: { userId, addedCompetitor: new Date() },
      update: { addedCompetitor: new Date() },
    });
  }
}

/**
 * Called when a brief is generated for the first time.
 */
export async function onBriefGenerated(userId: string): Promise<void> {
  await prisma.userActivationState.upsert({
    where: { userId },
    create: { userId, generatedBrief: new Date() },
    update: { generatedBrief: new Date() },
  });
}

/**
 * Called when Google Search Console is connected.
 * Cancels A7 (GSC nudge) since it's now redundant.
 */
export async function onGSCConnected(userId: string): Promise<void> {
  await prisma.userActivationState.upsert({
    where: { userId },
    create: { userId, connectedGSC: new Date() },
    update: { connectedGSC: new Date() },
  });
  // Cancel GSC nudge if not yet sent
  await prisma.scheduledEmail.updateMany({
    where: { userId, sequence: "trial", step: "A7", sentAt: null, cancelled: false },
    data: { cancelled: true },
  });
}

/**
 * Called when a report is generated.
 * Cancels B2 (report nudge).
 */
export async function onGeneratedReport(userId: string): Promise<void> {
  await prisma.userActivationState.upsert({
    where: { userId },
    create: { userId, generatedReport: new Date() },
    update: { generatedReport: new Date() },
  });
  await prisma.scheduledEmail.updateMany({
    where: { userId, sequence: "paid", step: "B2", sentAt: null, cancelled: false },
    data: { cancelled: true },
  });
}

/**
 * Called when a user converts to a paid plan.
 * Cancels remaining trial sequence (A8–A10) and starts the paid sequence.
 */
export async function onPaidConversion(
  userId: string,
  planName: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  const firstName = (user.name ?? "there").split(" ")[0];

  // Cancel remaining trial sequence
  await cancelSequence(userId, "trial");

  // Mark activation state
  await prisma.userActivationState.upsert({
    where: { userId },
    create: { userId, convertedToPaid: new Date() },
    update: { convertedToPaid: new Date() },
  });

  // B1 — immediate
  await buildAndSend(userId, user.email, "paid", "B1",
    `Welcome to BlockBoost ${planName} 🎉`,
    "billing",
    async (trackingId, unsubscribeToken) => {
      const { default: B1 } = await import("@/emails/B1-paid-welcome");
      const React = await import("react");
      const { renderEmail } = await import("@/lib/email-renderer");
      return renderEmail(React.createElement(B1, { firstName, planName, userId, unsubscribeToken, trackingId }));
    }
  );

  // Schedule B2–B5 — aligned to 9am cron
  await scheduleEmail(userId, "paid", "B2", nextSendTime(21));   // day 21 — report nudge (if no report)
  await scheduleEmail(userId, "paid", "B4", nextSendTime(30));   // day 30 — NPS
  await scheduleEmail(userId, "paid", "B5", nextSendTime(60));   // day 60 — re-engagement (if low usage)
  // B3 (monthly) is scheduled by the monthly cron, not here
}
