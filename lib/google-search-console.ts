/**
 * Google Search Console (GSC) integration helpers.
 *
 * Uses the official `googleapis` package for server-side OAuth2.
 * `@google-cloud/local-auth` is a CLI-only helper and is not used here.
 */

import { google } from "googleapis";

// ---------------------------------------------------------------------------
// OAuth2 client factory
// ---------------------------------------------------------------------------

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? `${process.env.NEXTAUTH_URL}/api/auth/gsc/callback`
  );
}

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ---------------------------------------------------------------------------
// Auth URL
// ---------------------------------------------------------------------------

/** Generates the Google OAuth consent URL. `state` is a base64url-encoded blob. */
export function getGSCAuthUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    prompt: "consent", // always ask so we always get a refresh_token
  });
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export interface GSCTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export async function exchangeCodeForTokens(code: string): Promise<GSCTokens> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date | null }> {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return {
    accessToken: credentials.access_token!,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
  };
}

// ---------------------------------------------------------------------------
// GSC properties
// ---------------------------------------------------------------------------

export interface GSCProperty {
  siteUrl: string;
  permissionLevel: string;
}

export async function getGSCProperties(accessToken: string): Promise<GSCProperty[]> {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });

  const webmasters = google.webmasters({ version: "v3", auth: client });
  const { data } = await webmasters.sites.list();

  return (data.siteEntry ?? [])
    .filter((s) => s.siteUrl && s.permissionLevel)
    .map((s) => ({
      siteUrl: s.siteUrl!,
      permissionLevel: s.permissionLevel!,
    }));
}

// ---------------------------------------------------------------------------
// Search analytics
// ---------------------------------------------------------------------------

export interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getTopQueries(
  accessToken: string,
  siteUrl: string,
  days = 90,
  rowLimit = 200
): Promise<GSCQuery[]> {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });

  const webmasters = google.webmasters({ version: "v3", auth: client });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const { data } = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      dimensions: ["query"],
      rowLimit,
      // GSC returns rows ordered by clicks desc by default;
      // we sort by impressions client-side after fetching
    },
  });

  const rows = (data.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    clicks: Math.round(row.clicks ?? 0),
    impressions: Math.round(row.impressions ?? 0),
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  // Sort by impressions descending
  return rows.sort((a, b) => b.impressions - a.impressions);
}

// ---------------------------------------------------------------------------
// Token validity helper (used by routes to auto-refresh)
// ---------------------------------------------------------------------------

export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false; // assume valid if no expiry stored
  // 5 min buffer
  return expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
}
