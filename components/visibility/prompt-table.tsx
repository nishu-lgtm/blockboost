"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { PromptRow, PromptResult } from "@/lib/visibility-types";

const ALL_PLATFORMS = ["ChatGPT", "Perplexity", "Gemini", "Copilot", "Grok", "Google AIO"];

const CATEGORY_COLORS: Record<string, string> = {
  awareness:  "bg-blue-50 text-blue-700 border-blue-200",
  comparison: "bg-purple-50 text-purple-700 border-purple-200",
  purchase:   "bg-green-50 text-green-700 border-green-200",
  custom:     "bg-orange-50 text-orange-700 border-orange-200",
};

const SENTIMENT_STYLE: Record<string, string> = {
  POSITIVE: "text-green-600",
  NEUTRAL: "text-slate-500",
  NEGATIVE: "text-red-600",
  NOT_MENTIONED: "text-slate-300",
};

type SortKey = "prompt" | "avg";
type SortDir = "asc" | "desc";

interface Props {
  rows: PromptRow[];
}

export function PromptTable({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("avg");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "avg" ? "desc" : "asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows
      .filter((r) => r.promptText.toLowerCase().includes(q))
      .sort((a, b) => {
        const mul = sortDir === "asc" ? 1 : -1;
        if (sortKey === "avg") return (a.avgMentionRate - b.avgMentionRate) * mul;
        return a.promptText.localeCompare(b.promptText) * mul;
      });
  }, [rows, search, sortKey, sortDir]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-slate-400" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 text-indigo-600" />
      : <ArrowDown className="h-3 w-3 text-indigo-600" />;
  }

  function getResult(row: PromptRow, platform: string): PromptResult | undefined {
    return row.results.find((r) => r.platform === platform);
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <Input
          placeholder="Filter prompts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm border-slate-300"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="w-6 px-3 py-2.5" />
              <th className="px-3 py-2.5 text-left">
                <button
                  onClick={() => handleSort("prompt")}
                  className="flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                >
                  Prompt <SortIcon col="prompt" />
                </button>
              </th>
              {ALL_PLATFORMS.map((pl) => (
                <th
                  key={pl}
                  className="px-2 py-2.5 text-center font-medium text-slate-500 whitespace-nowrap"
                >
                  {pl}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right">
                <button
                  onClick={() => handleSort("avg")}
                  className="flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 ml-auto"
                >
                  Avg <SortIcon col="avg" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={ALL_PLATFORMS.length + 3} className="py-10 text-center text-sm text-slate-400">
                  {rows.length === 0 ? "No prompts configured." : "No prompts match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const isOpen = expanded.has(row.promptId);
                return [
                  // Main row
                  <tr
                    key={row.promptId}
                    onClick={() => toggleExpand(row.promptId)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-3 py-3 text-slate-400">
                      {isOpen
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </td>
                    <td className="px-3 py-3 max-w-xs">
                      <div className="flex items-start gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 ${
                            CATEGORY_COLORS[row.category] ?? CATEGORY_COLORS.custom
                          }`}
                        >
                          {row.category}
                        </Badge>
                        <span className="text-slate-700 leading-snug line-clamp-2">
                          {row.promptText}
                        </span>
                      </div>
                    </td>
                    {ALL_PLATFORMS.map((pl) => {
                      const result = getResult(row, pl);
                      if (!result) {
                        return (
                          <td key={pl} className="px-2 py-3 text-center">
                            <span className="text-slate-200">—</span>
                          </td>
                        );
                      }
                      return (
                        <td key={pl} className="px-2 py-3 text-center">
                          {result.mentioned ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          row.avgMentionRate >= 66
                            ? "text-green-600"
                            : row.avgMentionRate >= 33
                            ? "text-amber-500"
                            : row.avgMentionRate > 0
                            ? "text-red-500"
                            : "text-slate-300"
                        }`}
                      >
                        {row.results.length > 0 ? `${row.avgMentionRate}%` : "—"}
                      </span>
                    </td>
                  </tr>,

                  // Expanded detail row
                  isOpen && (
                    <tr key={`${row.promptId}-detail`} className="bg-indigo-50/30">
                      <td />
                      <td colSpan={ALL_PLATFORMS.length + 2} className="px-4 py-4">
                        <div className="space-y-3">
                          {ALL_PLATFORMS.map((pl) => {
                            const result = getResult(row, pl);
                            if (!result) return null;
                            return (
                              <div key={pl} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-700">{pl}</span>
                                  {result.mentioned ? (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0">
                                      Mentioned
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px] px-1.5 py-0">
                                      Not Mentioned
                                    </Badge>
                                  )}
                                  {result.mentioned && result.mentionRank && (
                                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0">
                                      #{result.mentionRank} mention
                                    </Badge>
                                  )}
                                  <span
                                    className={`text-[10px] font-medium ml-auto ${
                                      SENTIMENT_STYLE[result.sentiment] ?? ""
                                    }`}
                                  >
                                    {result.sentiment.replace("_", " ")}
                                  </span>
                                </div>
                                {result.responseText ? (
                                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                                    {result.responseText}
                                  </p>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">No response captured.</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {filtered.length} of {rows.length} prompts
      </p>
    </div>
  );
}
