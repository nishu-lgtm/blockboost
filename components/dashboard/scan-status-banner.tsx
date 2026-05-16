"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, CheckCircle2, Sparkles, ExternalLink, X } from "lucide-react";

/**
 * Sticky banner that tells the user — on every dashboard page — what state
 * their scan is actually in. Polls /api/scan/status every 15s while a scan
 * is suspected to be running (sessionStorage flag set by the trigger UI).
 *
 * Why this exists: nishuprasad75 reported on 2026-05-16 that he triggered
 * a scan and "still dashboard shows 0% why?" — there was no feedback that
 * a scan was in flight, completed, or failed. The dashboard just looked
 * empty. This component closes that loop with a clear status line on
 * every page.
 */

type ScanState =
  | "never_scanned"
  | "complete_with_data"
  | "complete_empty_recent"
  | "complete_empty_stale";

interface StatusResponse {
  state: ScanState;
  lastScanAt: string | null;
  summary: { totalMentions: number; mentionRate: number; citationsFound: number };
  suspectedScraperIssue: boolean;
  apifyApprovalUrl: string | null;
}

// Frontend-only "running" hint, set by sessionStorage when /api/scan/trigger
// returns 202. Serverless can't track in-flight requests reliably so we lean
// on the client flag. Cleared as soon as totalMentions changes from 0 → >0.
const RUNNING_FLAG_KEY = "bb-scan-in-flight";
const RUNNING_TTL_MS = 10 * 60 * 1000; // 10 min — Apify could take this long

function isClientScanRunning(): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(RUNNING_FLAG_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < RUNNING_TTL_MS;
}

export function markScanRunning(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RUNNING_FLAG_KEY, String(Date.now()));
}

function clearScanRunning(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RUNNING_FLAG_KEY);
}

export function ScanStatusBanner({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan/status/${projectId}`);
      if (res.ok) {
        const data: StatusResponse = await res.json();
        setStatus(data);
        // If scan completed (data arrived), clear the client running flag
        if (data.state === "complete_with_data") clearScanRunning();
      }
    } catch {
      // silent — banner just won't update
    }
  }, [projectId]);

  // Initial fetch + poll while scan thought to be running
  useEffect(() => {
    setRunning(isClientScanRunning());
    load();
    const interval = setInterval(() => {
      setRunning(isClientScanRunning());
      if (isClientScanRunning()) load();
    }, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  if (dismissed) return null;
  if (!status) return null;

  // Decide which banner to render. Running state from the client flag wins,
  // unless we already have data (which means the scan succeeded).
  const showRunning = running && status.state !== "complete_with_data";

  if (showRunning) {
    return (
      <Banner color="indigo" icon={<Loader2 className="h-4 w-4 animate-spin" />}>
        <span className="font-medium">Scanning your brand across AI models…</span>
        <span className="text-indigo-700/80 ml-1.5">
          First results in 2–5 minutes. You can keep using the dashboard — this page will update automatically.
        </span>
      </Banner>
    );
  }

  if (status.state === "never_scanned") {
    return (
      <Banner color="slate" icon={<Sparkles className="h-4 w-4" />}>
        <span className="font-medium">No scan run yet.</span>
        <span className="text-slate-600 ml-1.5">
          Trigger your first scan from the{" "}
          <Link href="/dashboard/ai-visibility" className="underline font-medium hover:text-slate-900">
            AI Visibility page
          </Link>{" "}
          to populate your dashboard.
        </span>
      </Banner>
    );
  }

  if (status.state === "complete_empty_recent" && status.suspectedScraperIssue) {
    return (
      <Banner color="amber" icon={<AlertTriangle className="h-4 w-4" />}>
        <div className="flex-1 min-w-0">
          <p className="font-medium">Your scan completed but returned no data.</p>
          <p className="text-amber-800/90 text-xs mt-0.5">
            This usually means the AI scraper needs a one-time permission approval on Apify.{" "}
            {status.apifyApprovalUrl && (
              <>
                <a
                  href={status.apifyApprovalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium hover:text-amber-900 inline-flex items-center gap-0.5"
                >
                  Approve the scraper <ExternalLink className="h-3 w-3" />
                </a>
                , then re-trigger a scan.
              </>
            )}
          </p>
        </div>
        <DismissButton onClick={() => setDismissed(true)} />
      </Banner>
    );
  }

  if (status.state === "complete_empty_stale") {
    return (
      <Banner color="slate" icon={<AlertTriangle className="h-4 w-4" />}>
        <div className="flex-1 min-w-0">
          <p className="font-medium">Your last scan didn&apos;t find any brand mentions.</p>
          <p className="text-slate-600 text-xs mt-0.5">
            Try expanding your tracked prompts, or check that your brand name matches how it appears in AI responses.{" "}
            <Link href="/dashboard/ai-visibility" className="underline font-medium hover:text-slate-900">
              Re-run scan →
            </Link>
          </p>
        </div>
        <DismissButton onClick={() => setDismissed(true)} />
      </Banner>
    );
  }

  // complete_with_data → success state. Only show briefly; otherwise hide.
  if (status.state === "complete_with_data" && running) {
    return (
      <Banner color="emerald" icon={<CheckCircle2 className="h-4 w-4" />}>
        <span className="font-medium">Scan complete!</span>
        <span className="text-emerald-800/90 ml-1.5">
          Found mentions across {status.summary.totalMentions} platform-prompt combinations. {status.summary.mentionRate}% mention rate.
        </span>
      </Banner>
    );
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<string, string> = {
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-900",
  amber: "bg-amber-50 border-amber-200 text-amber-900",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
  slate: "bg-slate-50 border-slate-200 text-slate-800",
};

function Banner({
  color,
  icon,
  children,
}: {
  color: keyof typeof COLOR_CLASSES;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm mb-4 ${COLOR_CLASSES[color]}`}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss"
      className="text-current opacity-50 hover:opacity-100 transition-opacity shrink-0"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
