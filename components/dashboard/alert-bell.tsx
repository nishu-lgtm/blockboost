"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Bell, TrendingDown, Link2, Zap, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  read: boolean;
  createdAt: string;
  project: { id: string; name: string; brandName: string };
}

// ---------------------------------------------------------------------------
// Alert type config
// ---------------------------------------------------------------------------

const ALERT_CONFIG: Record<
  AlertType,
  { icon: React.ElementType; iconColor: string; iconBg: string; label: string }
> = {
  MENTION_RATE_DROP:      { icon: TrendingDown,  iconColor: "text-red-600",    iconBg: "bg-red-50",    label: "Rate Drop" },
  NEW_CITATION:           { icon: Link2,          iconColor: "text-green-600",  iconBg: "bg-green-50",  label: "New Citation" },
  COMPETITOR_SURGE:       { icon: Zap,            iconColor: "text-amber-600",  iconBg: "bg-amber-50",  label: "Competitor Surge" },
  HALLUCINATION_DETECTED: { icon: AlertTriangle,  iconColor: "text-orange-600", iconBg: "bg-orange-50", label: "Hallucination" },
  SCAN_COMPLETE:          { icon: CheckCircle,    iconColor: "text-indigo-600", iconBg: "bg-indigo-50", label: "Scan Complete" },
};

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
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// AlertBell component
// ---------------------------------------------------------------------------

export function AlertBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Poll unread count every 60 seconds
  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts/unread-count");
      if (res.ok) {
        const { count } = (await res.json()) as { count: number };
        setUnreadCount(count);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 60_000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // Load alerts when dropdown opens
  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) return;

    setLoading(true);
    try {
      const res = await fetch("/api/alerts?limit=10");
      if (res.ok) {
        const data = (await res.json()) as AlertItem[];
        setAlerts(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Mark a single alert as read
  async function markRead(alertId: string) {
    await fetch(`/api/alerts/${alertId}/read`, { method: "PATCH" }).catch(() => {});
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  // Mark all as read
  async function markAllRead() {
    await fetch("/api/alerts", { method: "PATCH", body: "{}", headers: { "Content-Type": "application/json" } }).catch(() => {});
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnreadCount(0);
  }

  const unreadAlerts = alerts.filter((a) => !a.read);

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger>
        <div className="relative h-9 w-9 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center bg-indigo-600 text-white text-[10px] font-bold rounded-full border border-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            {unreadCount > 0 && (
              <span className="h-5 min-w-5 px-1.5 flex items-center justify-center bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadAlerts.length > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Alert list */}
        <div className="max-h-[380px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {alerts.map((alert) => {
                const config = ALERT_CONFIG[alert.type];
                const Icon = config.icon;
                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer group ${
                      !alert.read ? "bg-indigo-50/30" : ""
                    }`}
                    onClick={() => !alert.read && markRead(alert.id)}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config.iconBg}`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-[13px] text-slate-700 leading-snug line-clamp-2 flex-1">
                          {alert.message}
                        </p>
                        {!alert.read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400">{timeAgo(alert.createdAt)}</span>
                        <span className="text-[11px] text-slate-300">·</span>
                        <span className="text-[11px] text-slate-400 truncate">
                          {alert.project.brandName}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-2.5">
          <Link
            href="/dashboard/alerts"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            onClick={() => setOpen(false)}
          >
            View all notifications →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
