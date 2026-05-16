/**
 * Derives a user-facing scan status from DB state.
 *
 * Why this exists: before today, when a scan was triggered the user saw
 * "Results in ~5 min" once on the onboarding page and then landed on a
 * dashboard showing 0% everywhere — no indication that work was happening
 * (or that it had failed). nishuprasad75 reported this directly on
 * 2026-05-16: "scan started a while back but still dashboard shows 0%
 * why?". The fix is a single source of truth that every UI surface can
 * read to show the right banner.
 *
 * Status derivation (no new DB columns required):
 *
 *   never_scanned          lastScannedAt == null  →  CTA to start scan
 *   complete_with_data     mentions > 0           →  show results, hide banner
 *   complete_empty_recent  scanned in last 5 min AND
 *                          mentions == 0          →  likely scraper issue
 *                                                    (e.g. Apify permission
 *                                                    not approved) — surface
 *                                                    diagnostic + fix link
 *   complete_empty_stale   scanned but mentions==0
 *                          AND not recent         →  ask user to re-scan;
 *                                                    explain why
 *
 * The `running` state is a frontend concern (sessionStorage flag set when
 * /api/scan/trigger returns 202) — we keep it out of this derivation since
 * Vercel serverless can't reliably track in-flight requests without a
 * dedicated DB column.
 */
import { prisma } from "@/lib/prisma";

export type ScanState =
  | "never_scanned"
  | "complete_with_data"
  | "complete_empty_recent"
  | "complete_empty_stale";

export interface ScanStatus {
  state: ScanState;
  lastScannedAt: Date | null;
  totalMentions: number;
  brandMentionedCount: number;
  mentionRate: number;
  /** Heuristic: scan very recent + 0 mentions → likely upstream scraper issue. */
  suspectedScraperIssue: boolean;
  /** Apify actor permission fix URL when suspectedScraperIssue is true. */
  apifyApprovalUrl: string | null;
}

const RECENT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// The Apify actor scan-engine uses for ChatGPT scraping. If this changes in
// lib/apify.ts, update here too. The "approvePermissions" URL is what users
// click in the Apify console to grant the actor full-access permission.
const APIFY_CHATGPT_ACTOR_ID = "SjvevRHp0tbpu3BeQ";

export async function getScanStatus(projectId: string): Promise<ScanStatus> {
  const [project, totalMentions, brandMentionedCount] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { lastScannedAt: true },
    }),
    prisma.mention.count({ where: { projectId } }),
    prisma.mention.count({ where: { projectId, brandMentioned: true } }),
  ]);

  const lastScannedAt = project?.lastScannedAt ?? null;
  const mentionRate =
    totalMentions > 0 ? Math.round((brandMentionedCount / totalMentions) * 100) : 0;

  let state: ScanState;
  let suspectedScraperIssue = false;

  if (!lastScannedAt) {
    state = "never_scanned";
  } else if (totalMentions > 0) {
    state = "complete_with_data";
  } else {
    const ageMs = Date.now() - lastScannedAt.getTime();
    if (ageMs < RECENT_WINDOW_MS) {
      // Scan finished recently but produced nothing — almost always a
      // scraper-level issue (Apify permission, actor down, rate limit).
      state = "complete_empty_recent";
      suspectedScraperIssue = true;
    } else {
      state = "complete_empty_stale";
    }
  }

  return {
    state,
    lastScannedAt,
    totalMentions,
    brandMentionedCount,
    mentionRate,
    suspectedScraperIssue,
    apifyApprovalUrl: suspectedScraperIssue
      ? `https://console.apify.com/actors/${APIFY_CHATGPT_ACTOR_ID}?approvePermissions=true`
      : null,
  };
}
