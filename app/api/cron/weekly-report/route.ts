import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendScanCompleteEmail } from "@/lib/email";
import { Platform, ReportType } from "@prisma/client";
import OpenAI from "openai";
import { compileReportData } from "@/lib/report-compiler";
import { renderToBuffer } from "@react-pdf/renderer";
import { put } from "@vercel/blob";
import { ReportPDF } from "@/components/report/ReportPDF";
import { createElement } from "react";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { runWithCronTracking } from "@/lib/cron-runner";

export const maxDuration = 300; // 5 minutes

// ---------------------------------------------------------------------------
// GET /api/cron/weekly-report — runs every Monday at 8:00 AM UTC
// Protected by CRON_SECRET header (Vercel passes it automatically)
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  // Auth check
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWithCronTracking("weekly-report", () => runWeeklyReport());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: "weekly-report failed", detail: String(err) },
      { status: 500 }
    );
  }
}

async function runWeeklyReport(): Promise<{ sent: number; failed: number }> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const weekLabel = `${oneWeekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // Fetch users with email notifications enabled
  const users = await prisma.user.findMany({
    where: { emailNotifications: true },
    select: { id: true, email: true },
  });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email) continue;

    // Fetch user's primary project
    const project = await prisma.project.findFirst({
      where: { userId: user.id },
      select: { id: true, brandName: true },
      orderBy: { createdAt: "asc" },
    });

    if (!project) continue;

    // Fetch mentions for this week and last week
    const [thisWeekMentions, lastWeekMentions] = await Promise.all([
      prisma.mention.findMany({
        where: { projectId: project.id, createdAt: { gte: oneWeekAgo } },
        select: { brandMentioned: true, platform: true },
      }),
      prisma.mention.findMany({
        where: {
          projectId: project.id,
          createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo },
        },
        select: { brandMentioned: true, platform: true },
      }),
    ]);

    if (thisWeekMentions.length === 0) continue; // no scan data this week

    // Overall mention rates
    const mentionRate = calcRate(thisWeekMentions);
    const prevMentionRate = lastWeekMentions.length >= 5 ? calcRate(lastWeekMentions) : null;

    // Per-platform rates — this week
    const platformMap = buildPlatformMap(thisWeekMentions);
    const prevPlatformMap = buildPlatformMap(lastWeekMentions);

    const platforms = [...platformMap.entries()]
      .map(([platform, { mentioned, total }]) => ({
        platform,
        rate: total > 0 ? Math.round((mentioned / total) * 100) : 0,
        prevRate: (() => {
          const prev = prevPlatformMap.get(platform);
          if (!prev || prev.total === 0) return null;
          return Math.round((prev.mentioned / prev.total) * 100);
        })(),
      }))
      .sort((a, b) => b.rate - a.rate);

    // Key insight + recommendations
    const keyInsight = buildKeyInsight(project.brandName, mentionRate, prevMentionRate, platforms);
    const recommendations = await generateRecommendations(project.brandName, mentionRate, platforms);

    try {
      await sendScanCompleteEmail({
        to: user.email,
        brandName: project.brandName,
        mentionRate,
        prevMentionRate,
        platforms,
        keyInsight,
        recommendations,
        weekLabel,
      });
      sent++;
    } catch (err) {
      console.error(`[weekly-report] Failed to email ${user.email}:`, err);
      failed++;
    }
  }

  // ── Monthly auto-report (runs on 1st of each month) ──────────────────────
  let autoReportsGenerated = 0;
  if (now.getDate() === 1) {
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    // Only GROWTH and ENTERPRISE users with email notifications on
    const eligibleUsers = await prisma.user.findMany({
      where: {
        emailNotifications: true,
        plan: { in: ["GROWTH", "ENTERPRISE"] },
      },
      select: { id: true },
    });

    for (const eu of eligibleUsers) {
      const projects = await prisma.project.findMany({
        where: { userId: eu.id },
        select: { id: true },
      });
      for (const proj of projects) {
        try {
          const reportData = await compileReportData(proj.id, prevMonthStart, prevMonthEnd);
          const branding = await prisma.reportBranding.findUnique({ where: { userId: eu.id } });
          const element = createElement(ReportPDF, {
            data: reportData,
            branding: branding
              ? {
                  logoUrl: branding.logoUrl,
                  primaryColor: branding.primaryColor,
                  companyName: branding.companyName,
                  tagline: branding.tagline,
                  showWatermark: branding.showWatermark,
                }
              : {},
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pdfBuffer = await renderToBuffer(element as any);
          let pdfUrl: string | null = null;
          try {
            const filename = `reports/${eu.id}/${proj.id}-monthly-${prevMonthStart.toISOString().slice(0, 7)}.pdf`;
            const blob = await put(filename, pdfBuffer, { access: "public", contentType: "application/pdf" });
            pdfUrl = blob.url;
          } catch { /* blob not configured */ }

          const { nanoid } = await import("nanoid");
          await prisma.report.create({
            data: {
              projectId: proj.id,
              userId: eu.id,
              shareToken: nanoid(32),
              reportType: ReportType.MONTHLY,
              periodStart: prevMonthStart,
              periodEnd: prevMonthEnd,
              data: reportData as object,
              pdfUrl,
            },
          });
          autoReportsGenerated++;
        } catch (err) {
          console.error(`[weekly-report] Auto-report failed for project ${proj.id}:`, err);
        }
      }
    }
  }

  return {
    sent,
    failed,
    usersProcessed: users.length,
    weekLabel,
    autoReportsGenerated,
  } as { sent: number; failed: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcRate(mentions: { brandMentioned: boolean }[]): number {
  if (mentions.length === 0) return 0;
  return Math.round((mentions.filter((m) => m.brandMentioned).length / mentions.length) * 100);
}

function buildPlatformMap(
  mentions: { brandMentioned: boolean; platform: Platform }[]
): Map<string, { mentioned: number; total: number }> {
  const map = new Map<string, { mentioned: number; total: number }>();
  for (const m of mentions) {
    const key = formatPlatform(m.platform);
    const entry = map.get(key) ?? { mentioned: 0, total: 0 };
    entry.total++;
    if (m.brandMentioned) entry.mentioned++;
    map.set(key, entry);
  }
  return map;
}

function formatPlatform(platform: Platform): string {
  const labels: Record<Platform, string> = {
    CHATGPT: "ChatGPT",
    PERPLEXITY: "Perplexity",
    GEMINI: "Gemini",
    COPILOT: "Copilot",
    GROK: "Grok",
    GOOGLE_AI_OVERVIEWS: "Google AI Overviews",
  };
  return labels[platform] ?? platform;
}

function buildKeyInsight(
  brandName: string,
  mentionRate: number,
  prevRate: number | null,
  platforms: { platform: string; rate: number }[]
): string {
  if (prevRate !== null) {
    const diff = mentionRate - prevRate;
    if (diff > 5) {
      return `${brandName}'s overall visibility improved by ${diff} percentage points this week. ${platforms[0] ? `Strongest platform: ${platforms[0].platform} at ${platforms[0].rate}%.` : ""}`;
    }
    if (diff < -5) {
      return `${brandName}'s AI visibility dropped by ${Math.abs(diff)} percentage points this week. Consider refreshing content that matches how AI models discuss your category.`;
    }
  }
  if (platforms.length > 1) {
    const best = platforms[0];
    const worst = platforms[platforms.length - 1];
    if (best.rate - worst.rate > 20) {
      return `There's a ${best.rate - worst.rate}pp gap between ${best.platform} (${best.rate}%) and ${worst.platform} (${worst.rate}%). Targeting ${worst.platform}'s preferred content formats could close this gap.`;
    }
  }
  return `${brandName} maintained a ${mentionRate}% AI mention rate this week. Keep monitoring for competitor positioning changes and new citation opportunities.`;
}

async function generateRecommendations(
  brandName: string,
  mentionRate: number,
  platforms: { platform: string; rate: number }[]
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const platformStr = platforms.map((p) => `${p.platform}: ${p.rate}%`).join(", ");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You are an AI visibility strategist. Provide exactly 3 concise, actionable recommendations as a JSON array of strings.",
        },
        {
          role: "user",
          content: `Brand: ${brandName}\nOverall mention rate: ${mentionRate}%\nPlatforms: ${platformStr}\n\nReturn JSON array of 3 specific action items to improve AI visibility.`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    const parsed = match ? (JSON.parse(match[0]) as string[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [];
  }
}
