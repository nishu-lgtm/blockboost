"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  TrendingDown, Link2, Zap, AlertTriangle, CheckCircle,
  Bell, Loader2, CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Topbar from "@/components/dashboard/topbar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertType =
  | "MENTION_RATE_DROP"
  | "NEW_CITATION"
  | "COMPETITOR_SURGE"
  | "HALLUCINATION_DETECTED"
  | "SCAN_COMPLETE";

interface AlertItem {
  id: string;
  type: AlertType;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  project: { id: string; name: string; brandName: string };
}

// ---------------------------------------------------------------------------
// Alert type config
// ---------------------------------------------------------------------------

const ALERT_CONFIG: Record<
  AlertType,
  {
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
    label: string;
    badgeClass: string;
  }
> = {
  MENTION_RATE_DROP:      { icon: TrendingDown,  iconColor: "text-red-600",    iconBg: "bg-red-50",    label: "Mention Rate Drop",      badgeClass: "bg-red-100 text-red-700 border-red-200" },
  NEW_CITATION:           { icon: Link2,          iconColor: "text-green-600",  iconBg: "bg-green-50",  label: "New Citation",           badgeClass: "bg-green-100 text-green-700 border-green-200" },
  COMPETITOR_SURGE:       { icon: Zap,            iconColor: "text-amber-600",  iconBg: "bg-amber-50",  label: "Competitor Surge",       badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
  HALLUCINATION_DETECTED: { icon: AlertTriangle,  iconColor: "text-orange-600", iconBg: "bg-orange-50", label: "Hallucination Detected", badgeClass: "bg-orange-100 text-orange-700 border-orange-200" },
  SCAN_COMPLETE:          { icon: CheckCircle,    iconColor: "text-indigo-600", iconBg: "bg-indigo-50", label: "Scan Complete",          badgeClass: "bg-indigo-100 text-indigo-700 border-indigo-200" },
};

const FILTER_TABS = [
  { id: "all",     label: "All" },
  { id: "unread",  label: "Unread" },
  { id: "SCAN_COMPLETE",          label: "Scans" },
  { id: "MENTION_RATE_DROP",      label: "Rate Drops" },
  { id: "COMPETITOR_SURGE",       label: "Competitors" },
  { id: "NEW_CITATION",           label: "Citations" },
  { id: "HALLUCINATION_DETECTED", label: "Hallucinations" },
] as const;

type FilterId = (typeof FILTER_TABS)[number]["id"];

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

// ---------------------------------------------------------------------------
// Alert card
// ---------------------------------------------------------------------------

function AlertCard({
  alert,
  onMarkRead,
}: {
  alert: AlertItem;
  onMarkRead: (id: string) => void;
}) {
  const config = ALERT_CONFIG[alert.type];
  const Icon = config.icon;

  // Data entries to display (exclude internal/noisy keys)
  const dataEntries = Object.entries(alert.data ?? {}).filter(
    ([k, v]) =>
      !["projectId", "userId"].includes(k) &&
      v !== null &&
      v !== undefined &&
      String(v).length > 0
  );

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        alert.read
          ? "bg-white border-slate-200"
          : "bg-indigo-50/40 border-indigo-100 shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg}`}
        >
          <Icon className={`h-4.5 w-4.5 ${config.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${config.badgeClass}`}
              >
                {config.label}
              </span>
              <Badge
                variant="outline"
                className="text-[11px] bg-slate-50 text-slate-500 border-slate-200"
              >
                {alert.project.brandName}
              </Badge>
              {!alert.read && (
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </div>
            <span className="text-xs text-slate-400 shrink-0">{timeAgo(alert.createdAt)}</span>
          </div>

          {/* Message */}
          <p className="text-sm text-slate-700 mt-2 leading-relaxed">{alert.message}</p>

          {/* Data breakdown */}
          {dataEntries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {dataEntries.map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">{formatKey(k)}:</span>
                  <span className="text-[11px] text-slate-600 font-semibold">{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Mark as read */}
          {!alert.read && (
            <button
              onClick={() => onMarkRead(alert.id)}
              className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [markingAll, setMarkingAll] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts?limit=100");
      if (res.ok) {
        setAlerts((await res.json()) as AlertItem[]);
      }
    } catch {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    // U6 — auto-refresh every 60s, no visible Refresh button.
    const id = window.setInterval(loadAlerts, 60_000);
    return () => window.clearInterval(id);
  }, [loadAlerts]);

  async function markRead(alertId: string) {
    await fetch(`/api/alerts/${alertId}/read`, { method: "PATCH" }).catch(() => {});
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  // Apply filters
  const filteredAlerts = alerts.filter((a) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !a.read;
    return a.type === activeFilter;
  });

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Notifications"
        description="Alerts and visibility events for your projects"
      />

      <main className="flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-slate-800">
              All Notifications
            </h2>
            {unreadCount > 0 && (
              <span className="h-6 min-w-6 px-2 flex items-center justify-center bg-indigo-600 text-white text-[11px] font-bold rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 text-indigo-600 gap-1.5 h-8"
                onClick={markAllRead}
                disabled={markingAll}
              >
                {markingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 flex-wrap mb-6 bg-slate-100 rounded-xl p-1 w-fit">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.id === "all"
                ? alerts.length
                : tab.id === "unread"
                ? unreadCount
                : alerts.filter((a) => a.type === tab.id).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeFilter === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                      activeFilter === tab.id
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Alert list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
            <p className="text-sm text-slate-400">Loading notifications…</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Bell className="h-8 w-8 text-slate-300" />
            </div>
            <div>
              <p className="text-base font-medium text-slate-600">No notifications</p>
              <p className="text-sm text-slate-400 mt-1">
                {activeFilter === "unread"
                  ? "You're all caught up! No unread notifications."
                  : "Notifications will appear here after scans run."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onMarkRead={markRead} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
