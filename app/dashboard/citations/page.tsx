"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Link2,
  Globe,
  Star,
  BarChart3,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";
import { CitationTimeline } from "@/components/citations/citation-timeline";
import type {
  CitationsData,
  ThirdPartyRow,
  HallucinationAlert,
} from "@/lib/citation-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DateRange = 7 | 30 | 90;

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-100 ${className}`} />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <Globe className="h-8 w-8 text-slate-200" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

const CATEGORY_STYLE: Record<ThirdPartyRow["category"], string> = {
  authoritative: "bg-green-50 text-green-700 border-green-200",
  review:        "bg-amber-50 text-amber-700 border-amber-200",
  social:        "bg-blue-50 text-blue-700 border-blue-200",
  news:          "bg-purple-50 text-purple-700 border-purple-200",
  other:         "bg-slate-50 text-slate-600 border-slate-200",
};

const CATEGORY_LABEL: Record<ThirdPartyRow["category"], string> = {
  authoritative: "Authoritative",
  review: "Review",
  social: "Social",
  news: "News",
  other: "Other",
};

const SEVERITY_STYLE: Record<HallucinationAlert["severity"], string> = {
  high:   "border-red-300 bg-red-50",
  medium: "border-amber-300 bg-amber-50",
  low:    "border-slate-200 bg-slate-50",
};

const SEVERITY_ICON_STYLE: Record<HallucinationAlert["severity"], string> = {
  high:   "text-red-500",
  medium: "text-amber-500",
  low:    "text-slate-400",
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CitationsPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [days, setDays] = useState<DateRange>(30);
  const [data, setData] = useState<CitationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects/list")
      .then((r) => r.json())
      .then((data: { projects?: Array<{ id: string }> }) => {
        const list = data.projects ?? [];
        if (list.length > 0) setProjectId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async (pid: string, d: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/citations/${pid}?days=${d}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load citation data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectId) loadData(projectId, days);
  }, [projectId, days, loadData]);

  const showLowOwnedWarning =
    data && data.summary.total > 0 && data.summary.ownedRate < 20;

  return (
    <div className="flex flex-col flex-1">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Citation Tracker</h1>
              <p className="text-xs text-slate-500">
                See which of your pages AI platforms cite — and which third-party sources they trust
              </p>
            </div>
          </div>

          {/* Date range pills */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            {([7, 30, 90] as DateRange[]).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  days === d
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {d === 7 ? "7 days" : d === 30 ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl w-full mx-auto">

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? [1, 2, 3, 4].map((i) => (
                <Card key={i} className="border-slate-200">
                  <CardContent className="p-5 flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-7 w-16" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))
            : [
                {
                  label: "Total Citations",
                  value: String(data?.summary.total ?? 0),
                  icon: BarChart3,
                  iconColor: "text-indigo-600",
                  iconBg: "bg-indigo-50",
                  sub: `last ${days} days`,
                },
                {
                  label: "Owned Citations",
                  value: String(data?.summary.owned ?? 0),
                  icon: Star,
                  iconColor: "text-green-600",
                  iconBg: "bg-green-50",
                  sub: data ? `${data.summary.ownedRate}% of all citations` : "your website",
                },
                {
                  label: "Third-Party Citations",
                  value: String(data?.summary.thirdParty ?? 0),
                  icon: Globe,
                  iconColor: "text-blue-600",
                  iconBg: "bg-blue-50",
                  sub: "external sources",
                },
                {
                  label: "Most Cited Platform",
                  value: data?.summary.mostCitedPlatform ?? "—",
                  icon: Link2,
                  iconColor: "text-amber-600",
                  iconBg: "bg-amber-50",
                  sub: "by citation count",
                },
              ].map((card) => (
                <Card key={card.label} className="border-slate-200">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                      <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-2xl font-bold truncate ${card.iconColor}`}>{card.value}</p>
                      <p className="text-xs text-slate-500 truncate">{card.label}</p>
                      {card.sub && <p className="text-[11px] text-slate-400 truncate">{card.sub}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Low-owned citation warning */}
        {showLowOwnedWarning && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-amber-800">
                AI platforms are rarely citing your website directly ({data!.summary.ownedRate}% of citations are yours).
              </p>
              <p className="text-xs text-amber-700">Here&apos;s what to fix:</p>
              <ul className="text-xs text-amber-700 space-y-1">
                {[
                  "Add structured data (FAQ, HowTo, Product schema) to your key pages so AI models can parse and attribute them.",
                  "Publish long-form, definitive content on topics where your brand should be the authority — AI models cite pages that directly answer queries.",
                  "Get coverage from authoritative third-party sources (Wikipedia, major news, G2/Capterra) — AI often defers to them first.",
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Citation tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Owned pages */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Star className="h-4 w-4 text-green-500" />
                Your pages being cited
              </CardTitle>
              <p className="text-xs text-slate-500">AI platforms are linking to these URLs</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !data || data.ownedPages.length === 0 ? (
                <EmptyState message="No owned citations found yet. Run a scan to see which of your pages AI cites." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2 text-left text-xs font-medium text-slate-500">Page URL</th>
                        <th className="py-2 text-right text-xs font-medium text-slate-500 w-14">Times</th>
                        <th className="py-2 text-right text-xs font-medium text-slate-500">Platforms</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.ownedPages.map((row) => (
                        <tr key={row.url} className="hover:bg-slate-50">
                          <td className="py-2.5 pr-2 max-w-[180px]">
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-indigo-600 hover:underline truncate text-xs"
                              title={row.url}
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{row.url.replace(/^https?:\/\//, "")}</span>
                            </a>
                          </td>
                          <td className="py-2.5 text-right text-sm font-semibold text-slate-700">{row.count}</td>
                          <td className="py-2.5 text-right">
                            <div className="flex flex-wrap gap-1 justify-end">
                              {row.platforms.slice(0, 2).map((pl) => (
                                <Badge key={pl} variant="outline" className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200">
                                  {pl}
                                </Badge>
                              ))}
                              {row.platforms.length > 2 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-500 border-slate-200">
                                  +{row.platforms.length - 2}
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Third-party domains */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                Third-party sources AI trusts
              </CardTitle>
              <p className="text-xs text-slate-500">External sites cited alongside your brand</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !data || data.thirdPartyDomains.length === 0 ? (
                <EmptyState message="No third-party citations found yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2 text-left text-xs font-medium text-slate-500">Domain</th>
                        <th className="py-2 text-right text-xs font-medium text-slate-500 w-14">Times</th>
                        <th className="py-2 text-right text-xs font-medium text-slate-500">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.thirdPartyDomains.map((row) => (
                        <tr key={row.domain} className="hover:bg-slate-50">
                          <td className="py-2.5 pr-2">
                            <span className="text-xs font-medium text-slate-700">{row.domain}</span>
                          </td>
                          <td className="py-2.5 text-right text-sm font-semibold text-slate-700">{row.count}</td>
                          <td className="py-2.5 text-right">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${CATEGORY_STYLE[row.category]}`}>
                              {CATEGORY_LABEL[row.category]}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              Citation Volume Over Time
            </CardTitle>
            <p className="text-xs text-slate-500">Your pages vs. third-party sources per day</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse rounded bg-slate-100 w-full h-52" />
            ) : (
              <CitationTimeline data={data?.timeline ?? []} />
            )}
          </CardContent>
        </Card>

        {/* Platform citation preferences */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              Platform Citation Preferences
            </CardTitle>
            <p className="text-xs text-slate-500">
              Domains each AI platform cites most — build content here or pursue coverage from these sources
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !data || data.platformPreferences.length === 0 ? (
              <EmptyState message="No platform preference data yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 text-left text-xs font-medium text-slate-500 w-28">Platform</th>
                      <th className="py-2 text-left text-xs font-medium text-slate-500">Top cited domains</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.platformPreferences.map((row) => (
                      <tr key={row.platform} className="hover:bg-slate-50">
                        <td className="py-3 pr-4 font-medium text-slate-700 text-xs align-top">{row.platform}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {row.topDomains.length === 0 ? (
                              <span className="text-xs text-slate-400">No data</span>
                            ) : (
                              row.topDomains.map((d) => (
                                <span
                                  key={d.domain}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]"
                                >
                                  {d.domain}
                                  <span className="font-semibold text-slate-400">×{d.count}</span>
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hallucination alerts */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  Hallucination Alerts
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Potentially incorrect AI claims about {data?.brandName ?? "your brand"}
                </p>
              </div>
              {data && data.hallucinationAlerts.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-slate-300 text-slate-600"
                  onClick={() => { window.location.href = "/dashboard/copilot"; }}
                >
                  Get fix recommendations
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : !data || data.hallucinationAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">No hallucinations detected</p>
                <p className="text-xs text-slate-400">
                  {data?.summary.total === 0
                    ? "Run a scan first to check for incorrect AI claims."
                    : "AI responses about your brand appear factually consistent."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.hallucinationAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 flex gap-3 ${SEVERITY_STYLE[alert.severity]}`}
                  >
                    <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${SEVERITY_ICON_STYLE[alert.severity]}`} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700">{alert.platform}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            alert.severity === "high"
                              ? "bg-red-100 text-red-700 border-red-300"
                              : alert.severity === "medium"
                              ? "bg-amber-100 text-amber-700 border-amber-300"
                              : "bg-slate-100 text-slate-600 border-slate-300"
                          }`}
                        >
                          {alert.severity} severity
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">{alert.claim}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
