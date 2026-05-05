/**
 * Admin audit logging helpers.
 * Every admin action should call logAudit().
 */

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export type AuditAction =
  | "VIEW_USER"
  | "VIEW_PAGE"
  | "SEND_EMAIL"
  | "IMPERSONATE_START"
  | "IMPERSONATE_END"
  | "BAN_USER"
  | "UNBAN_USER"
  | "CHANGE_PLAN"
  | "EXTEND_TRIAL"
  | "ISSUE_REFUND"
  | "DELETE_USER"
  | "INVITE_ADMIN"
  | "UPDATE_ROLE"
  | "REVOKE_ADMIN"
  | "TRIGGER_SCAN"
  | "TRIGGER_CRON"
  | "TEST_SCRAPER"
  | "CREATE_BANNER"
  | "UPDATE_BANNER"
  | "ADD_NOTE"
  | "EXPORT_CSV";

interface AuditOptions {
  adminUserId: string;
  action: AuditAction | string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(opts: AuditOptions): Promise<void> {
  try {
    // Try to get IP from request headers if not provided
    let ip = opts.ipAddress;
    if (!ip) {
      try {
        const headersList = await headers();
        ip =
          headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          headersList.get("x-real-ip") ??
          "unknown";
      } catch {
        ip = "unknown";
      }
    }

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: opts.adminUserId,
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId,
        details: (opts.details ?? {}) as object,
        ipAddress: ip,
      },
    });
  } catch (err) {
    // Never let audit logging break the main flow
    console.error("[audit] Failed to log:", err);
  }
}

/** Log a page view — call from admin layout or page server component */
export async function logPageView(
  adminUserId: string,
  page: string,
): Promise<void> {
  await logAudit({ adminUserId, action: "VIEW_PAGE", details: { page } });
}
