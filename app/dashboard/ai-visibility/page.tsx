"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart3,
  RefreshCw,
  ChevronDown,
  TrendingUp,
  Award,
  Link2,
  Radio,
  Clock,
  Loader2,
  Info,
  Search,
} from "lucide-react";
import { PlatformBarChart } from "@/components/visibility/platform-bar-chart";
import { TimeSeriesChart } from "@/components/visibility/time-series-chart";
import { PromptTable } from "@/components/visibility/prompt-table";
import { SentimentPieChart } from "@/components/visibility/sentiment-pie-chart";
import type { VisibilityData } from "@/lib/visibility-types";

// ---------------------------------------------------------------------------
// Query Intelligence types (mirrors app/api/gsc/insights/route.ts)
// ---------------------------------------------------------------------------

interface QueryInsight {
  promptId: string;
  promptText: string;
  category: string;
  gscImpressions: number;
  gscClicks: number;
  gscPosition: number;
  aiMentionRate: number;
  gapScore: number;
  priority: "critical" | "opportunity" | "winning" | "normal";
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-100 ${className}`} />;
}

function MetricCardSkeleton() {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-5 flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <div className="animate-pulse rounded bg-slate-100 w-full" style={{ height: `${height}px` }} />;
}

// ---------------------------------------------------------------------------
// Project type (fetched from existing projects endpoint)
// ---------------------------------------------------------------------------

interface ProjectSummary {
  id: string;
  name: string;
  brandName: string;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AIVisibilityPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [data, setData] = useState<VisibilityData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryInsights, setQueryInsights] = useState<QueryInsight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // ── Load user's projects on mount ─────────────────────────────────────
  useEffect(() => {
    fetch("/api/projects/list")
      .then((r) => r.json())
      .then((list: ProjectSummary[]) => {
        setProjects(list);
        if (list.length > 0) setSelectedProject(list[0]);
      })
      .catch(() => {
        // If the projects list endpoint doesn't exist yet, silently skip
      });
  }, []);

  // ── Load visibility data whenever selected project changes ────────────
  const loadData = useCallback(async (projectId: string) => {
    setLoadingData(true);
    setError(null);
    try {
      const res = await fetch(`/api/visibility/${projectId}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as VisibilityData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadData(selectedProject.id);
      // Load GSC query insights (only shows if GSC data exists)
      setLoadingInsights(true);
      setQueryInsights([]);
      fetch(`/api/gsc/insights?projectId=${selectedProject.id}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: QueryInsight[]) => setQueryInsights(rows))
        .catch(() => setQueryInsights([]))
        .finally(() => setLoadingInsights(false));
    }
  }, [selectedProject, loadData]);

  // ── Run scan ──────────────────────────────────────────────────────────
  async function handleScan() {
    if (!selectedProject) return;
    setScanning(true);
    try {
      const res = await fetch("/api/scan/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProject.id }),
      });
      if (!res.ok) throw new Error("Scan failed");
      // Reload data after scan
      await loadData(selectedProject.id);
    } catch {
      setError("Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────
  const platforms =
    data?.mentionRateOverTime && data.mentionRateOverTime.length > 0
      ? Object.keys(data.mentionRateOverTime[0]).filter((k) => k !== "date")
      : [];

  // Competitor avg for bar chart reference line (mean of all competitor-platform rates)
  // We don't have per-competitor platform data here, so we skip if no data
  const competitorAvg = undefined;

  function formatLastScan(iso: string | null | undefined): string {
    if (!iso) return "Never";
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="flex flex-col flex-1">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">AI Visibility</h1>
              <p className="text-xs text-slate-500">Track your brand across AI platforms</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Project selector */}
            {projects.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    {selectedProject?.name ?? "Select project"}
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className={selectedProject?.id === p.id ? "font-medium text-indigo-600" : ""}
                    >
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Last scanned */}
            {data?.lastScanAt !== undefined && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                <span>Scanned {formatLastScan(data.lastScanAt)}</span>
              </div>
            )}

            {/* Run scan button */}
            <Button
              size="sm"
              onClick={handleScan}
              disabled={scanning || !selectedProject}
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {scanning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {scanning ? "Scanning…" : "Run Scan Now"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">

        {/* ── Summary metric cards ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingData ? (
            [1, 2, 3, 4].map((i) => <MetricCardSkeleton key={i} />)
          ) : (
            <>
              <MetricCard
                label="Overall Mention Rate"
                value={data ? `${data.summaryMetrics.overallRate}%` : "—"}
                icon={TrendingUp}
                iconColor="text-indigo-600"
                iconBg="bg-indigo-50"
                sub={data ? `across ${data.mentionRateByPlatform.length} platforms` : undefined}
              />
              <MetricCard
                label="Best Platform"
                value={data?.summaryMetrics.bestPlatform ?? "—"}
                icon={Award}
                iconColor="text-amber-600"
                iconBg="bg-amber-50"
                sub={
                  data?.summaryMetrics.bestPlatform
                    ? `${
                        data.mentionRateByPlatform.find(
                          (p) => p.platform === data.summaryMetrics.bestPlatform
                        )?.rate ?? 0
                      }% mention rate`
                    : undefined
                }
              />
              <MetricCard
                label="Total Citations"
                value={data ? String(data.summaryMetrics.totalCitations) : "—"}
                icon={Link2}
                iconColor="text-green-600"
                iconBg="bg-green-50"
                sub="owned URLs cited"
              />
              <MetricCard
                label="Share of Voice"
                value={data ? `${data.summaryMetrics.shareOfVoice}%` : "—"}
                icon={Radio}
                iconColor="text-blue-600"
                iconBg="bg-blue-50"
                sub="vs. competitors"
              />
            </>
          )}
        </div>

        {/* ── Charts row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Platform bar chart */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800">
                Mention Rate by Platform
              </CardTitle>
              <p className="text-xs text-slate-500">
                % of prompts where your brand appeared
              </p>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <ChartSkeleton />
              ) : (
                <PlatformBarChart
                  data={data?.mentionRateByPlatform ?? []}
                  competitorAvg={competitorAvg}
                />
              )}
            </CardContent>
          </Card>

          {/* Sentiment pie */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800">
                Sentiment Breakdown
              </CardTitle>
              <p className="text-xs text-slate-500">
                Of responses where your brand was mentioned
              </p>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <ChartSkeleton height={140} />
              ) : (
                <SentimentPieChart data={data?.sentimentBreakdown ?? { positive: 0, neutral: 0, negative: 0 }} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Time series chart ─────────────────────────────────────── */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Mention Rate Over Time
                </CardTitle>
                <p className="text-xs text-slate-500">Last 30 days by platform</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <ChartSkeleton height={260} />
            ) : (
              <TimeSeriesChart
                data={data?.mentionRateOverTime ?? []}
                platforms={platforms}
              />
            )}
          </CardContent>
        </Card>

        {/* ── Prompt breakdown table ────────────────────────────────── */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Prompt-Level Breakdown
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Click a row to see the AI response for each platform
                </p>
              </div>
              {data && (
                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
                  {data.promptBreakdown.length} prompts
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <PromptTable rows={data?.promptBreakdown ?? []} />
            )}
          </CardContent>
        </Card>

        {/* ── Query Intelligence (GSC) ──────────────────────────────── */}
        {(loadingInsights || queryInsights.length > 0) && (
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Search className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-800">
                      Query Intelligence
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      Google Search Console data vs. AI mention rate
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Legend */}
                  <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200 inline-block" />
                      Critical gap
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-200 inline-block" />
                      Opportunity
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-200 inline-block" />
                      Winning
                    </span>
                  </div>
                  {!loadingInsights && (
                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
                      {queryInsights.length} queries
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingInsights ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[200px]">
                          Query
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                          GSC Impressions
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                          GSC Position
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                          AI Mention Rate
                        </th>
                        <th className="text-right px-4 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Gap Score
                            <span className="group relative">
                              <Info className="h-3 w-3 text-slate-400 cursor-help" />
                              <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-56 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-20 normal-case tracking-normal font-normal">
                                Gap Score = (Impressions ÷ 100) × (100 − AI Mention Rate%). Higher = bigger opportunity to improve AI visibility.
                              </span>
                            </span>
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {queryInsights.map((row) => (
                        <QueryInsightRowItem key={row.promptId} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric card component
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  sub?: string;
}

function MetricCard({ label, value, icon: Icon, iconColor, iconBg, sub }: MetricCardProps) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className={`text-2xl font-bold truncate ${iconColor}`}>{value}</p>
          <p className="text-xs text-slate-500 truncate">{label}</p>
          {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Query Intelligence row component
// ---------------------------------------------------------------------------

const PRIORITY_STYLES: Record<
  QueryInsight["priority"],
  { row: string; badge: string; badgeLabel: string }
> = {
  critical:    { row: "bg-red-50/60 hover:bg-red-50",         badge: "bg-red-100 text-red-700 border-red-200",       badgeLabel: "Critical" },
  opportunity: { row: "bg-amber-50/60 hover:bg-amber-50",     badge: "bg-amber-100 text-amber-700 border-amber-200", badgeLabel: "Opportunity" },
  winning:     { row: "bg-green-50/60 hover:bg-green-50",     badge: "bg-green-100 text-green-700 border-green-200", badgeLabel: "Winning" },
  normal:      { row: "bg-white hover:bg-slate-50",            badge: "bg-slate-100 text-slate-500 border-slate-200", badgeLabel: "" },
};

function QueryInsightRowItem({ row }: { row: QueryInsight }) {
  const styles = PRIORITY_STYLES[row.priority];

  return (
    <tr className={`transition-colors ${styles.row}`}>
      {/* Query */}
      <td className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800 font-medium leading-snug line-clamp-2">
              {row.promptText}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">{row.category}</span>
              {row.priority !== "normal" && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${styles.badge}`}>
                  {styles.badgeLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      {/* GSC Impressions */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-medium text-slate-700">
          {row.gscImpressions.toLocaleString()}
        </span>
      </td>
      {/* GSC Position */}
      <td className="px-4 py-3 text-right">
        <span className={`text-sm font-medium ${
          row.gscPosition <= 3
            ? "text-green-600"
            : row.gscPosition <= 10
            ? "text-amber-600"
            : "text-slate-500"
        }`}>
          {row.gscPosition > 0 ? `#${row.gscPosition.toFixed(1)}` : "—"}
        </span>
      </td>
      {/* AI Mention Rate */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Mini bar */}
          <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden hidden sm:block">
            <div
              className={`h-full rounded-full transition-all ${
                row.aiMentionRate >= 70
                  ? "bg-green-500"
                  : row.aiMentionRate >= 30
                  ? "bg-amber-400"
                  : "bg-red-400"
              }`}
              style={{ width: `${row.aiMentionRate}%` }}
            />
          </div>
          <span className={`text-sm font-medium tabular-nums ${
            row.aiMentionRate >= 70
              ? "text-green-600"
              : row.aiMentionRate >= 30
              ? "text-amber-600"
              : "text-red-600"
          }`}>
            {row.aiMentionRate}%
          </span>
        </div>
      </td>
      {/* Gap Score */}
      <td className="px-4 py-3 text-right">
        <span className={`text-sm font-bold tabular-nums ${
          row.priority === "critical"
            ? "text-red-600"
            : row.priority === "opportunity"
            ? "text-amber-600"
            : row.priority === "winning"
            ? "text-green-600"
            : "text-slate-600"
        }`}>
          {row.gapScore > 0 ? row.gapScore.toLocaleString() : "—"}
        </span>
      </td>
    </tr>
  );
}
