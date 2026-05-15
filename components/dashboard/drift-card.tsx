"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Smile,
  Frown,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { DriftReport, DriftItem, SentimentShift } from "@/lib/drift-detector";

const CATEGORIES = [
  {
    key: "newCitations" as const,
    label: "New citations",
    icon: TrendingUp,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    key: "lostCitations" as const,
    label: "Lost citations",
    icon: TrendingDown,
    iconColor: "text-red-500",
    iconBg: "bg-red-50",
    badgeColor: "bg-red-50 text-red-700 border-red-200",
  },
  {
    key: "newCompetitors" as const,
    label: "New competitor entrants",
    icon: UserPlus,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

function SentimentIcon({ direction }: { direction: "improved" | "regressed" }) {
  return direction === "improved" ? (
    <Smile className="h-3.5 w-3.5 text-emerald-500" />
  ) : (
    <Frown className="h-3.5 w-3.5 text-red-500" />
  );
}

export function DriftCard({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<DriftReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string>("newCitations");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drift/${projectId}?window=7`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drift");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-6 flex items-center gap-3 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Detecting drift…</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/40">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <span>Couldn&apos;t load drift report ({error})</span>
          </div>
          <button onClick={load} className="text-xs text-red-700 underline hover:no-underline">
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!report) return null;

  if (report.totalChanges === 0) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">No drift this week</p>
            <p className="text-xs text-slate-500">
              Your AI presence is stable across all tracked queries vs. last week.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeCategory = CATEGORIES.find((c) => c.key === activeKey);
  const activeItems: DriftItem[] = activeKey === "sentimentShifts"
    ? report.sentimentShifts
    : (activeCategory ? report[activeCategory.key] : []);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            What changed this week
          </CardTitle>
          <Badge variant="outline" className="text-xs text-slate-500">
            {report.totalChanges} change{report.totalChanges !== 1 ? "s" : ""}
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          AI answer drift over the last {report.windowDays} days vs. the {report.windowDays} days before.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Category tabs */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const count = report[c.key].length;
            const isActive = activeKey === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setActiveKey(c.key)}
                disabled={count === 0}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : count === 0
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <c.icon className={`h-3 w-3 ${isActive ? "text-white" : c.iconColor}`} />
                {c.label}
                <span className={`tabular-nums ${isActive ? "text-white" : "text-slate-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
          {report.sentimentShifts.length > 0 && (
            <button
              onClick={() => setActiveKey("sentimentShifts")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeKey === "sentimentShifts"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Smile className={`h-3 w-3 ${activeKey === "sentimentShifts" ? "text-white" : "text-sky-500"}`} />
              Sentiment shifts
              <span className={`tabular-nums ${activeKey === "sentimentShifts" ? "text-white" : "text-slate-500"}`}>
                {report.sentimentShifts.length}
              </span>
            </button>
          )}
        </div>

        {/* Active category items */}
        {activeItems.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No items in this category.</p>
        ) : (
          <div className="space-y-1.5">
            {activeItems.slice(0, 6).map((item) => (
              <div
                key={item.promptId + item.detail}
                className="flex items-start gap-2 px-3 py-2 rounded-md bg-slate-50 border border-slate-100"
              >
                {activeKey === "sentimentShifts" && (
                  <SentimentIcon direction={(item as SentimentShift).direction} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 line-clamp-1">{item.promptText}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.detail}</p>
                </div>
              </div>
            ))}
            {activeItems.length > 6 && (
              <p className="text-[11px] text-slate-400 pl-3">
                +{activeItems.length - 6} more
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
