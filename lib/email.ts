/**
 * Email sending utilities using Resend.
 * Uses inline HTML templates — no React Email dependency required.
 */

import { Resend } from "resend";
import { AlertType } from "@prisma/client";

// Lazy — do NOT instantiate at module load (throws during next build when key is absent)
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null; // caller should handle null → skip silently
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@blockboost.co";
const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

// ---------------------------------------------------------------------------
// Shared template helpers
// ---------------------------------------------------------------------------

/** Escape HTML special characters in user-supplied strings. */
function esc(str: string | number | null | undefined): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BlockBoost</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:40px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.06);">
  ${content}
  <!-- Footer -->
  <tr><td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      BlockBoost &nbsp;·&nbsp;
      <a href="${APP_URL}/dashboard/settings?tab=notifications" style="color:#94a3b8;text-decoration:underline;">Manage notifications</a>
      &nbsp;·&nbsp;
      <a href="${APP_URL}/dashboard" style="color:#94a3b8;text-decoration:underline;">Open dashboard</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function emailHeader(title: string, subtitle?: string): string {
  return `<tr><td style="padding:32px 32px 24px;border-bottom:1px solid #e2e8f0;">
  <table cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="width:36px;height:36px;background-color:#4f46e5;border-radius:8px;text-align:center;vertical-align:middle;line-height:36px;">
      <span style="color:#ffffff;font-size:20px;">📊</span>
    </td>
    <td style="padding-left:10px;vertical-align:middle;">
      <span style="font-size:17px;font-weight:700;color:#0f172a;">BlockBoost</span>
    </td>
  </tr></table>
  <h1 style="margin:20px 0 4px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">${title}</h1>
  ${subtitle ? `<p style="margin:0;font-size:14px;color:#64748b;">${subtitle}</p>` : ""}
</td></tr>`;
}

function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:9px;letter-spacing:0.01em;">${label} →</a>`;
}

function trendBadge(current: number, previous: number | null): string {
  if (previous === null) return "";
  const diff = current - previous;
  if (diff === 0) return `<span style="display:inline-block;background-color:#f1f5f9;color:#64748b;font-size:13px;font-weight:600;padding:4px 10px;border-radius:20px;">→ No change</span>`;
  if (diff > 0) return `<span style="display:inline-block;background-color:#dcfce7;color:#15803d;font-size:13px;font-weight:600;padding:4px 10px;border-radius:20px;">↑ +${diff}pp</span>`;
  return `<span style="display:inline-block;background-color:#fee2e2;color:#b91c1c;font-size:13px;font-weight:600;padding:4px 10px;border-radius:20px;">↓ ${diff}pp</span>`;
}

function platformRow(name: string, rate: number, prevRate: number | null): string {
  const barWidth = Math.max(2, rate);
  const diff = prevRate !== null ? rate - prevRate : null;
  const diffStr = diff === null ? "" : diff > 0 ? `+${diff}pp` : diff < 0 ? `${diff}pp` : "—";
  const diffColor = diff === null || diff === 0 ? "#94a3b8" : diff > 0 ? "#16a34a" : "#dc2626";

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:14px;">
  <tr>
    <td style="width:120px;font-size:13px;font-weight:600;color:#475569;vertical-align:middle;">${esc(name)}</td>
    <td style="vertical-align:middle;padding:0 12px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td style="background-color:#e2e8f0;border-radius:4px;height:8px;overflow:hidden;">
          <div style="background-color:#4f46e5;width:${barWidth}%;height:8px;border-radius:4px;min-width:4px;"></div>
        </td>
      </tr></table>
    </td>
    <td style="width:40px;font-size:14px;font-weight:700;color:#4f46e5;text-align:right;vertical-align:middle;">${rate}%</td>
    <td style="width:48px;font-size:12px;font-weight:600;color:${diffColor};text-align:right;vertical-align:middle;padding-left:8px;">${diffStr}</td>
  </tr>
</table>`;
}

// ---------------------------------------------------------------------------
// Scan complete / weekly report email
// ---------------------------------------------------------------------------

export interface ScanCompleteEmailOptions {
  to: string;
  brandName: string;
  mentionRate: number;
  prevMentionRate: number | null;
  platforms: { platform: string; rate: number; prevRate: number | null }[];
  keyInsight: string;
  recommendations?: string[];
  weekLabel?: string; // e.g. "Apr 28 – May 4, 2026"
}

export async function sendScanCompleteEmail(opts: ScanCompleteEmailOptions): Promise<void> {
  const {
    to,
    brandName,
    mentionRate,
    prevMentionRate,
    platforms,
    keyInsight,
    recommendations = [],
    weekLabel,
  } = opts;

  const top3 = platforms.slice(0, 3);
  const subtitle = weekLabel
    ? `Weekly summary · ${weekLabel}`
    : `Your latest AI visibility scan is ready`;

  const platformRows = top3.map((p) => platformRow(p.platform, p.rate, p.prevRate)).join("");

  const recSection =
    recommendations.length > 0
      ? `<tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 14px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;">Recommended Actions</p>
          <ol style="margin:0;padding-left:20px;">
            ${recommendations.map((r) => `<li style="font-size:14px;color:#334155;line-height:1.7;margin-bottom:6px;">${esc(r)}</li>`).join("")}
          </ol>
        </td></tr>`
      : "";

  const html = emailWrapper(`
    ${emailHeader(`AI Visibility Report — ${esc(brandName)}`, esc(subtitle))}
    <!-- Overall rate -->
    <tr><td style="padding:28px 32px;border-bottom:1px solid #e2e8f0;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;">Overall Mention Rate</p>
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:baseline;">
          <span style="font-size:52px;font-weight:800;color:#4f46e5;line-height:1;">${mentionRate}%</span>
        </td>
        <td style="vertical-align:middle;padding-left:14px;">
          ${trendBadge(mentionRate, prevMentionRate)}
          ${prevMentionRate !== null ? `<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">vs. ${prevMentionRate}% last period</p>` : ""}
        </td>
      </tr></table>
    </td></tr>
    <!-- Platform performance -->
    <tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
      <p style="margin:0 0 18px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;">Platform Performance</p>
      ${platformRows || `<p style="font-size:14px;color:#94a3b8;margin:0;">No platform data yet.</p>`}
    </td></tr>
    <!-- Key insight -->
    <tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;">Key Insight</p>
      <p style="margin:0;font-size:15px;color:#334155;line-height:1.7;">${esc(keyInsight)}</p>
    </td></tr>
    ${recSection}
    <!-- CTA -->
    <tr><td style="padding:28px 32px;text-align:center;">
      ${ctaButton("View Full Report", `${APP_URL}/dashboard/ai-visibility`)}
    </td></tr>
  `);

  const client = getResend();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set — skipping scan complete email");
    return;
  }
  await client.emails.send({
    from: FROM,
    to,
    subject: `Your weekly AI visibility scan is ready — ${esc(brandName)}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Alert notification email
// ---------------------------------------------------------------------------

const ALERT_META: Record<
  AlertType,
  { emoji: string; label: string; color: string; bgColor: string }
> = {
  MENTION_RATE_DROP: {
    emoji: "📉",
    label: "Mention Rate Drop",
    color: "#b91c1c",
    bgColor: "#fee2e2",
  },
  NEW_CITATION:      { emoji: "🔗", label: "New Citation",       color: "#047857", bgColor: "#d1fae5" },
  COMPETITOR_SURGE:  { emoji: "⚡", label: "Competitor Surge",   color: "#b45309", bgColor: "#fef3c7" },
  HALLUCINATION_DETECTED: { emoji: "⚠️", label: "Hallucination Detected", color: "#92400e", bgColor: "#fef3c7" },
  SCAN_COMPLETE:     { emoji: "✅", label: "Scan Complete",       color: "#1d4ed8", bgColor: "#dbeafe" },
};

export interface AlertEmailOptions {
  to: string;
  brandName: string;
  alertType: AlertType;
  message: string;
  data: Record<string, unknown>;
}

export async function sendAlertEmail(opts: AlertEmailOptions): Promise<void> {
  const { to, brandName, alertType, message, data } = opts;
  const meta = ALERT_META[alertType];

  // Build human-readable data rows
  const dataRows = Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:500;width:160px;">${esc(formatKey(k))}</td>
          <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:600;">${esc(String(v))}</td>
        </tr>`
    )
    .join("");

  const html = emailWrapper(`
    ${emailHeader(`[Alert] ${esc(meta.label)} — ${esc(brandName)}`)}
    <!-- Alert badge -->
    <tr><td style="padding:28px 32px 20px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="width:48px;height:48px;background-color:${meta.bgColor};border-radius:12px;text-align:center;vertical-align:middle;line-height:48px;font-size:24px;">
            ${meta.emoji}
          </td>
          <td style="padding-left:14px;vertical-align:middle;">
            <span style="display:inline-block;background-color:${meta.bgColor};color:${meta.color};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:4px 10px;border-radius:20px;">${meta.label}</span>
          </td>
        </tr>
      </table>
    </td></tr>
    <!-- Message -->
    <tr><td style="padding:0 32px 24px;border-bottom:1px solid #e2e8f0;">
      <p style="margin:0;font-size:16px;color:#0f172a;line-height:1.65;font-weight:500;">${esc(message)}</p>
    </td></tr>
    <!-- Data breakdown -->
    ${
      dataRows
        ? `<tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 14px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;">Details</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${dataRows}
            </table>
          </td></tr>`
        : ""
    }
    <!-- CTA -->
    <tr><td style="padding:28px 32px;text-align:center;">
      ${ctaButton("See What Changed", `${APP_URL}/dashboard/ai-visibility`)}
    </td></tr>
  `);

  const client = getResend();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set — skipping alert email");
    return;
  }
  await client.emails.send({
    from: FROM,
    to,
    subject: `[Alert] ${meta.label} detected for ${esc(brandName)}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Known abbreviations that should stay fully uppercase in display labels. */
const ABBREVS = /\b(Gsc|Ai|Url|Api|Id|Ctr|Cpc|Roi|Seo|Aeo|Geo|Sov)\b/g;

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
    .replace(ABBREVS, (m) => m.toUpperCase());
}
