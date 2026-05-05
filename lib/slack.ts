/**
 * Slack integration — incoming webhook posting with Block Kit formatting.
 */

import { AlertType } from "@prisma/client";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://visibilityiq.app";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackAlertPayload {
  type: AlertType;
  message: string;
  data: Record<string, unknown>;
  brandName?: string;
  projectId?: string;
}

// ---------------------------------------------------------------------------
// Alert type → Slack emoji + color
// ---------------------------------------------------------------------------

const ALERT_CONFIG: Record<AlertType, { emoji: string; color: string }> = {
  MENTION_RATE_DROP:      { emoji: "📉", color: "#dc2626" },
  NEW_CITATION:           { emoji: "🔗", color: "#059669" },
  COMPETITOR_SURGE:       { emoji: "⚡", color: "#d97706" },
  HALLUCINATION_DETECTED: { emoji: "⚠️", color: "#ea580c" },
  SCAN_COMPLETE:          { emoji: "✅", color: "#4f46e5" },
};

// ---------------------------------------------------------------------------
// Format alert data into readable Slack text
// ---------------------------------------------------------------------------

function formatAlertData(data: Record<string, unknown>): string {
  return Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
      return `*${label}:* ${String(v)}`;
    })
    .join("  ·  ");
}

// ---------------------------------------------------------------------------
// Post to Slack incoming webhook
// ---------------------------------------------------------------------------

export async function postToSlack(
  webhookUrl: string,
  payload: SlackAlertPayload
): Promise<void> {
  const { type, message, data, brandName = "your brand" } = payload;
  const config = ALERT_CONFIG[type];
  const dataStr = formatAlertData(data);
  const label = type.replace(/_/g, " ");

  const body = {
    text: `${config.emoji} ${label} — ${brandName}`,
    attachments: [
      {
        color: config.color,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${config.emoji} *${label}*\n${message}`,
            },
          },
          ...(dataStr
            ? [
                {
                  type: "section",
                  text: { type: "mrkdwn", text: dataStr },
                },
              ]
            : []),
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Open Dashboard" },
                url: `${APP_URL}/dashboard/ai-visibility`,
                style: "primary",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "View Alerts" },
                url: `${APP_URL}/dashboard/alerts`,
              },
            ],
          },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Slack OAuth helpers
// ---------------------------------------------------------------------------

export function getSlackAuthUrl(state: string): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) throw new Error("SLACK_CLIENT_ID not configured");

  const redirectUri = process.env.SLACK_REDIRECT_URI ?? `${APP_URL}/api/slack/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "incoming-webhook",
    redirect_uri: redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(
  code: string
): Promise<{ webhookUrl: string; channelName: string }> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI ?? `${APP_URL}/api/slack/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Slack credentials not configured");
  }

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    incoming_webhook?: { url: string; channel: string };
  };

  if (!data.ok || !data.incoming_webhook) {
    throw new Error(data.error ?? "Slack OAuth exchange failed");
  }

  return {
    webhookUrl: data.incoming_webhook.url,
    channelName: data.incoming_webhook.channel,
  };
}
