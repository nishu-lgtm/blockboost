"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText, Zap, Search, CheckCircle2, Loader2, AlertTriangle,
} from "lucide-react";
import { BRAND_COLORS } from "@/components/competitors/sov-chart";
import type { PromptGapRow, BriefRow } from "@/lib/brief-types";

const CATEGORY_STYLE: Record<string, string> = {
  awareness:  "bg-blue-50 text-blue-700 border-blue-200",
  comparison: "bg-purple-50 text-purple-700 border-purple-200",
  purchase:   "bg-green-50 text-green-700 border-green-200",
  custom:     "bg-orange-50 text-orange-700 border-orange-200",
};

function priorityLabel(score: number): { label: string; cls: string } {
  if (score >= 6) return { label: "Critical", cls: "bg-red-50 text-red-700 border-red-200" };
  if (score >= 3) return { label: "High",     cls: "bg-amber-50 text-amber-700 border-amber-200" };
  if (score >= 1) return { label: "Medium",   cls: "bg-blue-50 text-blue-700 border-blue-200" };
  return               { label: "Low",        cls: "bg-slate-50 text-slate-600 border-slate-200" };
}

interface Props {
  gaps: PromptGapRow[];
  projectId: string;
  allBrands: string[];   // [yourBrand, ...competitorBrands] — for color mapping
  onBriefGenerated: (brief: BriefRow) => void;
}

export function PromptGapsTab({ gaps, projectId, allBrands, onBriefGenerated }: Props) {
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(
    new Set(gaps.filter((g) => g.hasBrief).map((g) => g.promptId))
  );

  const filtered = gaps.filter((g) =>
    g.promptText.toLowerCase().includes(search.toLowerCase())
  );

  async function generateBrief(gap: PromptGapRow) {
    setGenerating((prev) => new Set(prev).add(gap.promptId));
    try {
      const res = await fetch("/api/briefs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, promptText: gap.promptText, promptId: gap.promptId }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const brief = await res.json() as BriefRow;
      setGeneratedIds((prev) => new Set(prev).add(gap.promptId));
      onBriefGenerated(brief);
    } catch { /* silently fail — button stays active */ }
    finally {
      setGenerating((prev) => {
        const next = new Set(prev);
        next.delete(gap.promptId);
        return next;
      });
    }
  }

  async function generateAll() {
    const pending = filtered.filter((g) => !generatedIds.has(g.promptId));
    if (pending.length === 0) return;
    setGeneratingAll(true);
    // Sequential to avoid rate-limits
    for (const gap of pending) {
      try {
        const res = await fetch("/api/briefs/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, promptText: gap.promptText, promptId: gap.promptId }),
        });
        if (res.ok) {
          const brief = await res.json() as BriefRow;
          setGeneratedIds((prev) => new Set(prev).add(gap.promptId));
          onBriefGenerated(brief);
        }
      } catch { /* continue */ }
    }
    setGeneratingAll(false);
  }

  if (gaps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <CheckCircle2 className="h-10 w-10 text-green-400" />
        <p className="text-sm font-semibold text-slate-700">No prompt gaps detected</p>
        <p className="text-xs text-slate-400 max-w-xs">
          Your brand appears for every tracked prompt, or no scan data exists yet. Run a scan to identify gaps.
        </p>
      </div>
    );
  }

  const pendingCount = filtered.filter((g) => !generatedIds.has(g.promptId)).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Filter prompts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm border-slate-300"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500">
            {filtered.length} gap{filtered.length !== 1 ? "s" : ""}
          </span>
          {pendingCount > 0 && (
            <Button
              size="sm"
              onClick={generateAll}
              disabled={generatingAll}
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {generatingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              {generatingAll ? "Generating…" : `Generate All (${pendingCount})`}
            </Button>
          )}
        </div>
      </div>

      {/* Alert */}
      {gaps.some((g) => g.priorityScore >= 6) && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            <strong>Critical gaps detected.</strong> Competitors appear without you on multiple platforms for high-priority prompts. Generate briefs to close these gaps fast.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Prompt</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">Platforms Missing</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">Competitors Appearing</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-slate-500">Priority</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
                  No prompts match your search.
                </td>
              </tr>
            ) : (
              filtered.map((gap) => {
                const isDone = generatedIds.has(gap.promptId);
                const isGen = generating.has(gap.promptId);
                const prio = priorityLabel(gap.priorityScore);
                return (
                  <tr key={gap.promptId} className={`hover:bg-slate-50 transition-colors ${isDone ? "opacity-60" : ""}`}>
                    {/* Prompt */}
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline"
                          className={`text-[9px] px-1 py-0 shrink-0 mt-0.5 ${CATEGORY_STYLE[gap.category] ?? CATEGORY_STYLE.custom}`}>
                          {gap.category}
                        </Badge>
                        <p className="text-xs text-slate-700 leading-snug line-clamp-2">{gap.promptText}</p>
                      </div>
                    </td>

                    {/* Platforms missing */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {gap.platformsMissing.slice(0, 3).map((pl) => (
                          <Badge key={pl} variant="outline"
                            className="text-[9px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200">
                            {pl}
                          </Badge>
                        ))}
                        {gap.platformsMissing.length > 3 && (
                          <span className="text-[10px] text-slate-400">+{gap.platformsMissing.length - 3}</span>
                        )}
                        {gap.platformsMissing.length === 0 && (
                          <span className="text-[10px] text-slate-400">All platforms</span>
                        )}
                      </div>
                    </td>

                    {/* Competitors */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {gap.competitorsAppearing.slice(0, 3).map((comp, i) => {
                          const idx = allBrands.indexOf(comp);
                          return (
                            <Badge key={comp} variant="outline"
                              className="text-[9px] px-1.5 py-0 border-slate-300"
                              style={{ color: BRAND_COLORS[idx > 0 ? idx : 1] ?? "#94a3b8",
                                borderColor: BRAND_COLORS[idx > 0 ? idx : 1] ?? "#e2e8f0" }}>
                              {comp}
                            </Badge>
                          );
                        })}
                        {gap.competitorsAppearing.length === 0 && (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${prio.cls}`}>
                          {prio.label}
                        </Badge>
                        <span className="text-[10px] text-slate-400">score {gap.priorityScore}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-3 py-3 text-right">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-green-600 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Brief ready
                        </span>
                      ) : (
                        <Button size="sm" variant="outline"
                          disabled={isGen || generatingAll}
                          onClick={() => generateBrief(gap)}
                          className="h-8 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-1.5">
                          {isGen ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          {isGen ? "Generating…" : "Generate Brief"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
