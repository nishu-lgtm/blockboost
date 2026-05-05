import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { subDays } from "date-fns";

export const GET = adminRoute("VIEWER", async () => {
  const emails = await prisma.adminEmail.findMany({
    orderBy: { sentAt: "desc" },
    take: 100,
  });

  // Fetch sender details
  const senderIds = [...new Set(emails.map((e) => e.sentBy))];
  const senders = await prisma.user.findMany({
    where: { id: { in: senderIds } },
    select: { id: true, name: true, email: true },
  });
  const senderMap = Object.fromEntries(senders.map((s) => [s.id, s]));

  const enriched = emails.map((e) => ({
    id: e.id,
    subject: e.subject,
    audience: e.audience,
    recipientCount: e.sentTo,
    sentAt: e.sentAt,
    sentBy: senderMap[e.sentBy] ?? { name: null, email: e.sentBy },
  }));

  return NextResponse.json({ emails: enriched });
});

export const POST = adminRoute("SUPPORT", async (req: NextRequest, { admin }) => {
  const body = (await req.json()) as {
    audience: string;
    planFilter?: string[];
    trialDays?: number;
    churnDays?: number;
    singleEmail?: string;
    customList?: string[];
    subject: string;
    fromName: string;
    fromEmail: string;
    htmlBody: string;
    testOnly?: boolean;
  };

  // Resolve recipient list
  let recipients: string[] = [];

  if (body.testOnly) {
    recipients = [admin.email];
  } else {
    const now = new Date();
    let users: { email: string }[] = [];

    switch (body.audience) {
      case "everyone":
        users = await prisma.user.findMany({
          where: { adminRole: "NONE", adminBanned: false },
          select: { email: true },
        });
        break;
      case "paid":
        users = await prisma.user.findMany({
          where: { adminRole: "NONE", plan: { not: "FREE" } },
          select: { email: true },
        });
        break;
      case "plan":
        users = await prisma.user.findMany({
          where: {
            adminRole: "NONE",
            plan: { in: (body.planFilter ?? []).map((p) => p.toUpperCase()) as never },
          },
          select: { email: true },
        });
        break;
      case "trial":
        users = await prisma.user.findMany({
          where: {
            adminRole: "NONE",
            plan: "FREE",
            createdAt: { gte: subDays(now, 14) },
          },
          select: { email: true },
        });
        break;
      case "trial_expiring":
        users = await prisma.user.findMany({
          where: {
            adminRole: "NONE",
            plan: "FREE",
            createdAt: {
              gte: subDays(now, 14),
              lte: subDays(now, 14 - (body.trialDays ?? 3)),
            },
          },
          select: { email: true },
        });
        break;
      case "churned":
        users = await prisma.user.findMany({
          where: {
            adminRole: "NONE",
            plan: "FREE",
            updatedAt: { gte: subDays(now, body.churnDays ?? 30) },
          },
          select: { email: true },
        });
        break;
      case "single":
        if (body.singleEmail) recipients = [body.singleEmail];
        break;
      case "custom":
        recipients = body.customList ?? [];
        break;
    }

    if (users.length) recipients = users.map((u) => u.email);
  }

  recipients = [...new Set(recipients.filter(Boolean))];

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients found" }, { status: 400 });
  }

  // Send via Resend
  const resendKey = process.env.RESEND_API_KEY;
  let sentCount = 0;

  if (resendKey && !body.testOnly) {
    const resend = new Resend(resendKey);
    // Send in batches of 100
    for (let i = 0; i < recipients.length; i += 100) {
      const batch = recipients.slice(i, i + 100);
      await Promise.allSettled(
        batch.map((to) =>
          resend.emails.send({
            from: `${body.fromName} <${body.fromEmail}>`,
            to,
            subject: body.subject,
            html: body.htmlBody,
          }),
        ),
      );
      sentCount += batch.length;
    }
  } else if (body.testOnly && resendKey) {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: `${body.fromName} <${body.fromEmail}>`,
      to: admin.email,
      subject: `[TEST] ${body.subject}`,
      html: body.htmlBody,
    });
    sentCount = 1;
  }

  // Record in DB
  await prisma.adminEmail.create({
    data: {
      subject: body.subject,
      fromName: body.fromName,
      fromEmail: body.fromEmail,
      audience: body.audience,
      sentTo: sentCount || recipients.length,
      htmlBody: body.htmlBody,
      status: body.testOnly ? "test" : "sent",
      sentBy: admin.id,
    },
  });

  await logAudit({
    adminUserId: admin.id,
    action: "SEND_EMAIL",
    details: {
      subject: body.subject,
      audience: body.audience,
      sentTo: sentCount || recipients.length,
      testOnly: body.testOnly,
    },
  });

  return NextResponse.json({
    ok: true,
    sentTo: sentCount || recipients.length,
    testOnly: body.testOnly,
  });
});
