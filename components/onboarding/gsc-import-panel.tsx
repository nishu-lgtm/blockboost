"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, ChevronDown, Loader2, ToggleLeft, ToggleRight,
  ExternalLink, AlertTriangle,
} from "lucide-react";
import type { PromptItem } from "@/lib/onboarding-types";

interface GSCProperty {
  siteUrl: string;
  permissionLevel: string;
}

interface ImportedQuery {
  text: string;
  category: string;
  impressions: number;
  position: number;
}

const CATEGORY_STYLE: Record<string, string> = {
  awareness:     "bg-blue-50 text-blue-700 border-blue-200",
  comparison:    "bg-purple-50 text-purple-700 border-purple-200",
  purchase:      "bg-green-50 text-green-700 border-green-200",
  local:         "bg-orange-50 text-orange-700 border-orange-200",
  informational: "bg-slate-50 text-slate-600 border-slate-200",
};

interface Props {
  basics: { websiteUrl: string; brandName: string };
  onImported: (prompts: PromptItem[]) => void;
}

export function GscImportPanel({ basics, onImported }: Props) {
  const [properties, setProperties] = useState<GSCProperty[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [selectedProp, setSelectedProp] = useState<string>("");
  const [showPropDropdown, setShowPropDropdown] = useState(false);
  const [importing, setImporting] = useState(false);
  const [queries, setQueries] = useState<ImportedQuery[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState("");

  // Fetch properties on mount
  useEffect(() => {
    fetch("/api/gsc/properties")
      .then((r) => r.json())
      .then((data: GSCProperty[] | { error: string }) => {
        if (Array.isArray(data)) {
          setProperties(data);
          // Auto-select property that matches their website URL
          const match = data.find((p) =>
            basics.websiteUrl && p.siteUrl.includes(
              basics.websiteUrl.replace(/^https?:\/\//, "").split("/")[0]
            )
          );
          if (match) setSelectedProp(match.siteUrl);
          else if (data.length > 0) setSelectedProp(data[0].siteUrl);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProps(false));
  }, [basics.websiteUrl]);

  async function handleImport() {
    if (!selectedProp) return;
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/gsc/import-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: selectedProp, limit: 50 }),
      });
      if (!res.ok) throw new Error("Import failed");
      const data = await res.json() as { queries: ImportedQuery[] };
      setQueries(data.queries ?? []);
      // All selected by default
      setSelected(new Set(data.queries.map((q) => q.text)));
    } catch {
      setImportError("Failed to import queries. Check your GSC connection.");
    } finally {
      setImporting(false);
    }
  }

  function toggleQuery(text: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  }

  function addSelectedToPrompts() {
    const toAdd: PromptItem[] = queries
      .filter((q) => selected.has(q.text))
      .map((q) => ({
        id: `gsc-${crypto.randomUUID()}`,
        text: q.text,
        category: q.category,
        selected: true,
        isCustom: false,
      }));
    onImported(toAdd);
  }

  if (loadingProps) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
        Fetching your GSC properties…
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          No verified properties found in your Google Search Console account.
          Make sure you have at least one verified site at{" "}
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            search.google.com/search-console
          </a>
          .
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Property selector */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-600">Select your GSC property</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPropDropdown((v) => !v)}
            className="w-full flex items-center justify-between px-3 h-10 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="truncate">{selectedProp || "Choose a property…"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </button>
          {showPropDropdown && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
              {properties.map((p) => (
                <button
                  key={p.siteUrl}
                  type="button"
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                    selectedProp === p.siteUrl ? "text-indigo-700 bg-indigo-50/50 font-medium" : "text-slate-700"
                  }`}
                  onClick={() => { setSelectedProp(p.siteUrl); setShowPropDropdown(false); }}
                >
                  <span className="truncate">{p.siteUrl}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">{p.permissionLevel}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Import button */}
      {queries.length === 0 ? (
        <Button
          type="button"
          onClick={handleImport}
          disabled={!selectedProp || importing}
          className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
        >
          {importing ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Fetching your top search queries…</>
          ) : (
            <>Import Top 50 Queries</>
          )}
        </Button>
      ) : null}

      {importError && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {importError}
        </p>
      )}

      {/* Query table */}
      {queries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-700">
              {selected.size} of {queries.length} queries selected
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set(queries.map((q) => q.text)))}
                className="text-[10px] text-indigo-600 hover:underline"
              >
                Select all
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-[10px] text-slate-500 hover:underline"
              >
                Deselect all
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <th className="px-3 py-2 text-left font-medium text-slate-500 w-6"></th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Query</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Impressions</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Avg Position</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queries.map((q) => {
                  const isSelected = selected.has(q.text);
                  return (
                    <tr
                      key={q.text}
                      onClick={() => toggleQuery(q.text)}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-indigo-50/40" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-3 py-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-xs">
                        <p className="truncate text-slate-700">{q.text}</p>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-600">
                        {q.impressions.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        #{q.position}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${CATEGORY_STYLE[q.category] ?? CATEGORY_STYLE.informational}`}>
                          {q.category}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            onClick={addSelectedToPrompts}
            disabled={selected.size === 0}
            className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Add {selected.size} selected quer{selected.size === 1 ? "y" : "ies"} to tracking list
          </Button>
        </div>
      )}
    </div>
  );
}
