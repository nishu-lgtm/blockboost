"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { BRAND_COLORS } from "@/components/competitors/sov-chart";
import type { EnrichedGapRow } from "@/lib/gap-analyzer";

const INTENT_LABEL: Record<string, string> = {
  comparison: "Compare",
  recommendation: "Recommend",
  how_to: "How-to",
  informational: "Info",
  navigational: "Navigate",
};

function ScorePip({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-red-500" : score >= 50 ? "bg-amber-500" : "bg-slate-300";
  const label =
    score >= 75 ? "High" : score >= 50 ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs font-semibold tabular-nums text-slate-700">{score}</span>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}

interface Props {
  projectId: string;
  allBrands: string[];
  onGenerateBrief: (promptId: string, promptText: string) => void;
  generatingBrief: string | null;
}

export function GapPanel({ projectId, allBrands, onGenerateBrief, generatingBrief }: Props) {
  const [rows, setRows] = useState<EnrichedGapRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gaps/${projectId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load gaps");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
    // U6 — auto-refresh every 60s. No visible refresh control; system handles freshness.
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900">
            Content Gap Intelligence
          </CardTitle>
          {rows && rows.length > 0 && (
            <span className="text-xs text-slate-500 tabular-nums">
              {rows.length} gap{rows.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Queries where competitors appear but you don&apos;t — ranked by urgency with content recommendations.
        </p>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50/40 p-3 flex items-center justify-between">
            <span className="text-sm text-red-700">Couldn&apos;t load gaps ({error})</span>
            <button onClick={load} className="text-xs text-red-700 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {!loading && rows?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
            <p className="text-sm font-medium text-slate-700">No content gaps found</p>
            <p className="text-xs text-slate-400">
              You appear in every query where your competitors appear, or no scans exist yet.
            </p>
          </div>
        )}

        {!loading && rows && rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((row) => {
              const isOpen = expanded === row.promptId;
              return (
                <div
                  key={row.promptId}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  {/* Row header */}
                  <button
                    className="w-full flex items-start gap-3 px-3 py-3 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setExpanded(isOpen ? null : row.promptId)}
                  >
                    <ScorePip score={row.gapScore} />

                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                        {row.promptText}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {row.intent && INTENT_LABEL[row.intent] && (
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                            {INTENT_LABEL[row.intent]}
                          </span>
                        )}
                        {row.competitorsPresent.map((comp) => {
                          const idx = allBrands.indexOf(comp);
                          return (
                            <span
                              key={comp}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-600"
                            >
                              <span
                                aria-hidden
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: BRAND_COLORS[idx] ?? "#94a3b8" }}
                              />
                              {comp}
                            </span>
                          );
                        })}
                        {row.missingEntities.length > 0 && (
                          <span className="text-[10px] text-slate-400">
                            missing: {row.missingEntities.slice(0, 2).join(", ")}
                            {row.missingEntities.length > 2 ? ` +${row.missingEntities.length - 2}` : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {isOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    )}
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-3 py-3 bg-white border-t border-slate-100 space-y-3">
                      {/* Content hint */}
                      <p className="text-xs text-slate-600 leading-relaxed">{row.contentHint}</p>

                      {/* Missing entity tags */}
                      {row.missingEntities.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                            Missing entity coverage
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {row.missingEntities.map((e) => (
                              <span key={e} className="text-xs text-slate-600">
                                {e}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CTA */}
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          disabled={generatingBrief === row.promptId}
                          onClick={() => onGenerateBrief(row.promptId, row.promptText)}
                        >
                          {generatingBrief === row.promptId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          Create content brief
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
