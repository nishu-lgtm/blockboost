/**
 * Cancellation flow email templates.
 * Mirrors the inline-HTML pattern from lib/email.ts.
 */
import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@blockboost.co";
const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

function wrap(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BlockBoost</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;">
<tr><td align="center" style="padding:40px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
${content}
<tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#94a3b8;">BlockBoost &nbsp;·&nbsp;
    <a href="${APP_URL}/dashboard/settings?tab=billing" style="color:#94a3b8;text-decoration:underline;">Manage subscription</a>
  </p>
</td></tr>
</table></td></tr>
</table>
</body></html>`;
}

function header(emoji: string, headline: string) {
  return `<tr><td style="padding:40px 32px 24px;border-bottom:1px solid #f1f5f9;">
  <p style="margin:0 0 12px;font-size:32px;">${emoji}</p>
  <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">${headline}</h1>
</td></tr>`;
}

function body(html: string) {
  return `<tr><td style="padding:24px 32px;">${html}</td></tr>`;
}

function button(text: string, href: string, color = "#F59E0B") {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;margin-top:20px;">${text}</a>`;
}

// ── Email types ───────────────────────────────────────────────

type EmailType = "pause_confirmed" | "resumed" | "cancelled_day1" | "winback_day30" | "winback_day90";

interface SendOpts {
  to: string;
  name: string | null;
  type: EmailType;
  data: Record<string, string>;
}

export async function sendCancellationOfferEmail(opts: SendOpts): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const first = opts.name ? opts.name.split(" ")[0] : "there";
  let subject = "";
  let html = "";

  switch (opts.type) {
    case "pause_confirmed": {
      subject = "Your BlockBoost account is paused ⏸️";
      html = wrap(
        header("⏸️", "Your account is paused") +
        body(`
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${first},</p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Your BlockBoost subscription is paused until <strong>${opts.data.pauseUntil}</strong>. Your data, settings, and projects are all safely preserved.</p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 4px;">We'll automatically resume your account on that date — or you can come back early any time.</p>
          ${button("Resume early", `${APP_URL}/dashboard/settings?tab=billing`)}
        `),
      );
      break;
    }

    case "resumed": {
      subject = "Welcome back — your BlockBoost account is active 🎉";
      html = wrap(
        header("🎉", "Your account is active again") +
        body(`
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${first},</p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Your pause period ended on ${opts.data.resumedDate} and your BlockBoost subscription has automatically resumed. Everything is right where you left it.</p>
          ${button("Go to dashboard", `${APP_URL}/dashboard`)}
        `),
      );
      break;
    }

    case "cancelled_day1": {
      subject = "Your BlockBoost data is safe — here's your summary";
      html = wrap(
        header("📊", "Your data is safe") +
        body(`
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${first},</p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">We're sorry to see you go. Your subscription will remain active until <strong>${opts.data.periodEnd}</strong>, so you have full access until then.</p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Your projects and visibility data are kept safely even after your subscription ends. If you ever come back, everything will be waiting.</p>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin:20px 0;">
            <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">💡 Changed your mind?</p>
            <p style="margin:6px 0 0;font-size:13px;color:#92400e;">You can reactivate your subscription any time before ${opts.data.periodEnd}.</p>
          </div>
          ${button("Go to dashboard", opts.data.dashboardUrl ?? `${APP_URL}/dashboard`, "#6366F1")}
        `),
      );
      break;
    }

    case "winback_day30": {
      subject = "We've been busy — here's what's new at BlockBoost";
      html = wrap(
        header("🚀", "A lot has changed since you left") +
        body(`
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${first},</p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">It's been 30 days since you cancelled. We've been shipping fast — here are a few things that have landed:</p>
          <ul style="color:#475569;font-size:15px;line-height:1.9;padding-left:20px;margin:0 0 16px;">
            <li>Faster AI visibility scans (2× speed improvement)</li>
            <li>New Grok &amp; Google AI Overviews tracking</li>
            <li>Competitor mention alerts</li>
            <li>Weekly PDF reports with executive summary</li>
          </ul>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 4px;">We'd love to have you back.</p>
          ${button("See what's new", `${APP_URL}/dashboard`)}
        `),
      );
      break;
    }

    case "winback_day90": {
      subject = "We miss you — 40% off to come back 🎁";
      html = wrap(
        header("🎁", "A special offer — just for you") +
        body(`
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${first},</p>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">It's been 90 days and we still think BlockBoost can help your business. So we're making it easy to come back.</p>
          <div style="background:#fffbeb;border:2px solid #F59E0B;border-radius:16px;padding:24px;text-align:center;margin:20px 0;">
            <p style="margin:0 0 4px;font-size:32px;font-weight:800;color:#92400e;">40% OFF</p>
            <p style="margin:0;font-size:14px;color:#92400e;">Your first month back${opts.data.couponCode ? ` — use code <strong>${opts.data.couponCode}</strong>` : ""}</p>
            <p style="margin:8px 0 0;font-size:12px;color:#b45309;">Offer expires ${opts.data.expiresDate}</p>
          </div>
          ${button("Claim 40% off", `${APP_URL}/pricing`)}
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">This is a one-time offer that expires on ${opts.data.expiresDate}. No pressure — we just miss you.</p>
        `),
      );
      break;
    }
  }

  try {
    await resend.emails.send({ from: FROM, to: opts.to, subject, html });
  } catch (err) {
    console.error("[email-cancel] send failed:", err);
  }
}
