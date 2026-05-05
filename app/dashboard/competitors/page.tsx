"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users2,
  Settings2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  TrendingUp,
  Zap,
  FileText,
  Globe,
  Loader2,
} from "lucide-react";
import { SoVChart, BRAND_COLORS } from "@/components/competitors/sov-chart";
import { CompetitorTrendChart } from "@/components/competitors/trend-chart";
import { ManageCompetitorsModal } from "@/components/competitors/manage-modal";
import type { CompetitorData, CompetitorInfo, H2HPromptRow } from "@/lib/competitor-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-100 ${className}`} />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <Users2 className="h-8 w-8 text-slate-200" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

const OUTCOME_ROW_BG: Record<H2HPromptRow["outcome"], string> = {
  win:   "bg-green-50 hover:bg-green-100",
  loss:  "bg-red-50 hover:bg-red-100",
  tie:   "bg-amber-50 hover:bg-amber-50",
  empty: "bg-white hover:bg-slate-50",
};

const OUTCOME_BADGE: Record<H2HPromptRow["outcome"], { label: string; cls: string }> = {
  win:   { label: "You win",   cls: "bg-green-100 text-green-700 border-green-200" },
  loss:  { label: "You lose",  cls: "bg-red-100 text-red-700 border-red-200" },
  tie:   { label: "Tie",       cls: "bg-amber-100 text-amber-700 border-amber-200" },
  empty: { label: "No data",   cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CompetitorsPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [data, setData] = useState<CompetitorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState<string | null>(null); // promptId

  useEffect(() => {
    fetch("/api/projects/list")
      .then((r) => r.json())
      .then((list: Array<{ id: string }>) => {
        if (list.length > 0) setProjectId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async (pid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/competitors/${pid}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectId) loadData(projectId);
  }, [projectId, loadData]);

  function handleCompetitorsSaved(updated: CompetitorInfo[]) {
    if (data) setData({ ...data, competitors: updated, allBrands: [data.brandName, ...updated.map((c) => c.brandName)] });
    if (projectId) loadData(projectId); // reload full data
  }

  async function generateBrief(promptId: string, promptText: string) {
    if (!projectId) return;
    setGeneratingBrief(promptId);
    try {
      await fetch("/api/briefs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, promptId, promptText }),
      });
      // Navigate to content briefs page after triggering
      window.location.href = "/dashboard/content-briefs";
    } catch {
      // fail silently — still redirect
      window.location.href = "/dashboard/content-briefs";
    } finally {
      setGeneratingBrief(null);
    }
  }

  const competitors = data?.competitors ?? [];
  const allBrands = data?.allBrands ?? [];
  const yourBrand = data?.brandName ?? "Your Brand";

  // H2H summary row: win/loss counts
  const winCount = data?.h2hRows.filter((r) => r.outcome === "win").length ?? 0;
  const lossCount = data?.h2hRows.filter((r) => r.outcome === "loss").length ?? 0;
  const tieCount = data?.h2hRows.filter((r) => r.outcome === "tie").length ?? 0;

  return (
    <div className="flex flex-col flex-1">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Users2 className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Competitor Intelligence</h1>
              <p className="text-xs text-slate-500">
                Track how you stack up against competitors across every AI platform
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setModalOpen(true)}
            className="h-9 border-slate-300 text-slate-700 gap-1.5"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Manage Competitors
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">

        {/* No competitors callout */}
        {!loading && data && competitors.length === 0 && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 flex items-start gap-3">
            <Users2 className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-indigo-800">No competitors added yet</p>
              <p className="text-xs text-indigo-700">
                Add up to {data.planLimit} competitors to see head-to-head comparisons, share of voice, and prompt gaps.
              </p>
              <Button
                size="sm"
                onClick={() => setModalOpen(true)}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Users2 className="h-3.5 w-3.5 mr-1.5" />
                Add competitors
              </Button>
            </div>
          </div>
        )}

        {/* ── Win/Loss scoreboard ──────────────────────────────────────── */}
        {(!loading && data && competitors.length > 0) && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Prompts you win", count: winCount, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", desc: "Mentioned, competitors not" },
              { label: "Prompts you lose", count: lossCount, icon: XCircle, color: "text-red-600", bg: "bg-red-50", desc: "Competitors mentioned, you not" },
              { label: "Tied prompts", count: tieCount, icon: MinusCircle, color: "text-amber-600", bg: "bg-amber-50", desc: "Both or neither mentioned" },
            ].map((item) => (
              <Card key={item.label} className="border-slate-200">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
                    <p className="text-xs text-slate-600 font-medium">{item.label}</p>
                    <p className="text-[11px] text-slate-400">{item.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {loading && (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-slate-200">
                <CardContent className="p-5 flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="space-y-2 flex-1"><Skeleton className="h-7 w-12" /><Skeleton className="h-3 w-24" /></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Share of Voice chart ─────────────────────────────────────── */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              Share of Voice by Platform
            </CardTitle>
            <p className="text-xs text-slate-500">
              What percentage of AI responses mention each brand — stacked per platform
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse rounded bg-slate-100 w-full h-52" />
            ) : (
              <SoVChart data={data?.sovByPlatform ?? []} brands={allBrands} />
            )}
          </CardContent>
        </Card>

        {/* ── Head-to-head table ───────────────────────────────────────── */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Head-to-Head by Prompt
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Green row = you win · Red row = you lose · Amber = tied
                </p>
              </div>
              {data && (
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {winCount} wins
                  </Badge>
                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                    {lossCount} losses
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
            ) : !data || data.h2hRows.length === 0 ? (
              <EmptyState message="No prompts configured. Add prompts during onboarding or in Settings." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 max-w-xs">Prompt</th>
                      {/* Your brand */}
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-indigo-600">
                        {yourBrand}
                        <span className="ml-1 font-normal text-slate-400">(you)</span>
                      </th>
                      {/* Competitor columns */}
                      {allBrands.slice(1).map((comp) => (
                        <th key={comp} className="px-3 py-2.5 text-center text-xs font-medium text-slate-600">
                          {comp}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-500">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.h2hRows.map((row) => (
                      <tr key={row.promptId} className={`transition-colors ${OUTCOME_ROW_BG[row.outcome]}`}>
                        <td className="px-3 py-2.5 max-w-xs">
                          <p className="text-xs text-slate-700 line-clamp-2">{row.promptText}</p>
                        </td>
                        {allBrands.map((brand, i) => {
                          const mentioned = row.results[brand];
                          if (mentioned === undefined) return null;
                          return (
                            <td key={brand} className="px-3 py-2.5 text-center">
                              {mentioned ? (
                                <CheckCircle2
                                  className={`h-4.5 w-4.5 mx-auto ${i === 0 ? "text-indigo-600" : "text-slate-400"}`}
                                  style={{ width: "18px", height: "18px" }}
                                />
                              ) : (
                                <XCircle className="h-4.5 w-4.5 text-slate-200 mx-auto" style={{ width: "18px", height: "18px" }} />
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${OUTCOME_BADGE[row.outcome].cls}`}>
                            {OUTCOME_BADGE[row.outcome].label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {/* Summary / win-rate row */}
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="px-3 py-2.5 text-xs font-semibold text-slate-600">Win Rate</td>
                      {allBrands.map((brand, i) => (
                        <td key={brand} className="px-3 py-2.5 text-center">
                          <span className={`text-sm font-bold ${i === 0 ? "text-indigo-600" : "text-slate-500"}`}>
                            {data.h2hSummary.winRates[brand] ?? 0}%
                          </span>
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Competitor visibility trend ──────────────────────────────── */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              Visibility Trend — Last 30 Days
            </CardTitle>
            <div className="flex flex-wrap gap-3 mt-1">
              {allBrands.map((brand, i) => (
                <div key={brand} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: BRAND_COLORS[i] ?? "#94a3b8" }}
                  />
                  {i === 0 ? <strong>{brand} (you)</strong> : brand}
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse rounded bg-slate-100 w-full h-60" />
            ) : (
              <CompetitorTrendChart data={data?.trendData ?? []} brands={allBrands} />
            )}
          </CardContent>
        </Card>

        {/* ── Prompt gap analysis ──────────────────────────────────────── */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base font-semibold text-slate-800">
                Prompt Gap Analysis
              </CardTitle>
            </div>
            <p className="text-xs text-slate-500">
              Prompts where competitors appear but <strong className="text-slate-700">you don&apos;t</strong> — highest-priority gaps to close
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !data || data.gapRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
                <p className="text-sm font-medium text-slate-700">No prompt gaps found</p>
                <p className="text-xs text-slate-400">
                  {data?.h2hRows.length === 0
                    ? "Add competitors and run a scan to identify gaps."
                    : "You appear in every prompt where your competitors appear. Great work!"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500">Prompt</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500">Competitors present</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.gapRows.map((row) => (
                      <tr key={row.promptId} className="hover:bg-red-50 transition-colors bg-red-50/40">
                        <td className="px-3 py-3 max-w-sm">
                          <p className="text-xs text-slate-700 line-clamp-2">{row.promptText}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.competitorsPresent.map((comp, i) => {
                              const idx = allBrands.indexOf(comp);
                              return (
                                <Badge
                                  key={comp}
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-600"
                                  style={{ borderColor: BRAND_COLORS[idx] ?? "#94a3b8", color: BRAND_COLORS[idx] ?? "#64748b" }}
                                >
                                  {comp}
                                </Badge>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-1.5"
                            disabled={generatingBrief === row.promptId}
                            onClick={() => generateBrief(row.promptId, row.promptText)}
                          >
                            {generatingBrief === row.promptId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                            Generate Brief
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Competitor citation sources ──────────────────────────────── */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-base font-semibold text-slate-800">
                Citation Sources Comparison
              </CardTitle>
            </div>
            <p className="text-xs text-slate-500">
              Domains AI platforms use when citing each brand — gaps are link-building opportunities
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : !data || data.citationSources.length === 0 ? (
              <EmptyState message="No citation data yet." />
            ) : (
              <div className="space-y-4">
                {data.citationSources.map((row, i) => (
                  <div key={row.brand} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: BRAND_COLORS[i] ?? "#94a3b8" }}
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        {row.brand}{i === 0 ? " (you)" : ""}
                      </span>
                    </div>
                    {row.domains.length === 0 ? (
                      <p className="text-xs text-slate-400 pl-4">No citation data yet — run a scan first.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pl-4">
                        {row.domains.map((d) => (
                          <span
                            key={d.domain}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]"
                          >
                            {d.domain}
                            <span className="font-semibold text-slate-400">×{d.count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </main>

      {/* ── Manage competitors modal ─────────────────────────────────── */}
      {data && (
        <ManageCompetitorsModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          projectId={data.projectId}
          competitors={data.competitors}
          planLimit={data.planLimit}
          onSaved={handleCompetitorsSaved}
        />
      )}
    </div>
  );
}
