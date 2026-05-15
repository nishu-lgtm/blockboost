"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  FileText,
  Loader2,
  CheckCircle2,
  Lightbulb,
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

  useEffect(() => { load(); }, [load]);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base font-semibold text-slate-800">
              Content Gap Intelligence
            </CardTitle>
          </div>
          {rows && rows.length > 0 && (
            <Badge className="bg-red-50 text-red-600 border-red-200 text-xs" variant="outline">
              {rows.length} gap{rows.length !== 1 ? "s" : ""}
            </Badge>
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
                    className="w-full flex items-start gap-3 px-3 py-3 bg-red-50/50 hover:bg-red-50 transition-colors text-left"
                    onClick={() => setExpanded(isOpen ? null : row.promptId)}
                  >
                    <ScorePip score={row.gapScore} />

                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                        {row.promptText}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {row.intent && INTENT_LABEL[row.intent] && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-500 border-slate-200">
                            {INTENT_LABEL[row.intent]}
                          </Badge>
                        )}
                        {row.competitorsPresent.map((comp) => {
                          const idx = allBrands.indexOf(comp);
                          return (
                            <Badge
                              key={comp}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                              style={{
                                borderColor: BRAND_COLORS[idx] ?? "#94a3b8",
                                color: BRAND_COLORS[idx] ?? "#64748b",
                              }}
                            >
                              {comp}
                            </Badge>
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
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 p-3">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed">{row.contentHint}</p>
                      </div>

                      {/* Missing entity tags */}
                      {row.missingEntities.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                            Missing entity coverage
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {row.missingEntities.map((e) => (
                              <Badge
                                key={e}
                                variant="outline"
                                className="text-xs bg-violet-50 text-violet-700 border-violet-200"
                              >
                                {e}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CTA */}
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-1.5"
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
