"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/dashboard/topbar";
import { BriefCard } from "@/components/briefs/brief-card";
import { BriefModal } from "@/components/briefs/brief-modal";
import { PromptGapsTab } from "@/components/briefs/prompt-gaps-tab";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, BookOpen, AlertTriangle, Loader2 } from "lucide-react";
import type { BriefRow, PromptGapRow } from "@/lib/brief-types";

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

function BriefCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="flex gap-1.5">
          <Skeleton className="w-10 h-5 rounded-full" />
          <Skeleton className="w-14 h-5 rounded-full" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2 mt-1" />
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project type
// ---------------------------------------------------------------------------

interface ProjectSummary {
  id: string;
  name: string;
  brandName: string;
  competitors?: Array<{ brandName: string }>;
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type ActiveTab = "briefs" | "gaps";

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ContentBriefsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [briefs, setBriefs] = useState<BriefRow[]>([]);
  const [gapRows, setGapRows] = useState<PromptGapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("briefs");
  const [selectedBrief, setSelectedBrief] = useState<BriefRow | null>(null);

  // Load projects on mount
  useEffect(() => {
    fetch("/api/projects/list")
      .then((r) => r.json())
      .then((data: { projects?: ProjectSummary[] }) => {
        const list = data.projects ?? [];
        setProjects(list);
        if (list.length > 0) setSelectedProject(list[0]);
      })
      .catch(() => {});
  }, []);

  // Load briefs data whenever project changes
  const loadData = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/briefs/${projectId}`);
      if (!res.ok) throw new Error("Failed to load briefs");
      const json = await res.json() as { briefs: BriefRow[]; gapRows: PromptGapRow[] };
      setBriefs(json.briefs);
      setGapRows(json.gapRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load briefs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) loadData(selectedProject.id);
  }, [selectedProject, loadData]);

  // Merge a newly-generated brief into local state
  function handleBriefGenerated(newBrief: BriefRow) {
    setBriefs((prev) => {
      const idx = prev.findIndex((b) => b.id === newBrief.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newBrief;
        return next;
      }
      return [newBrief, ...prev];
    });
    // Mark the gap as having a brief now
    setGapRows((prev) =>
      prev.map((g) =>
        g.promptText === newBrief.promptText
          ? { ...g, hasBrief: true, briefId: newBrief.id }
          : g
      )
    );
    // Switch to briefs tab so user can see the new brief
    setActiveTab("briefs");
  }

  // Status change from modal
  function handleStatusChange(briefId: string, status: "PENDING" | "GENERATED" | "PUBLISHED") {
    setBriefs((prev) =>
      prev.map((b) => (b.id === briefId ? { ...b, status } : b))
    );
    if (selectedBrief?.id === briefId) {
      setSelectedBrief((prev) => (prev ? { ...prev, status } : prev));
    }
  }

  // Build allBrands array for color mapping: [yourBrand, ...competitors]
  const allBrands: string[] = selectedProject
    ? [
        selectedProject.brandName,
        ...(selectedProject.competitors?.map((c) => c.brandName) ?? []),
      ]
    : [];

  const pendingGaps = gapRows.filter((g) => !g.hasBrief).length;

  const TABS: { key: ActiveTab; label: string; count?: number }[] = [
    { key: "briefs", label: "Generated Briefs", count: briefs.length },
    { key: "gaps",   label: "Prompt Gaps",      count: pendingGaps || undefined },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Content Briefs"
        description="AI-generated content briefs to close your AEO visibility gaps"
      />

      <main className="flex-1 p-4 md:p-6 space-y-5">
        {/* Header row: project selector + tab switcher */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Project selector */}
          {projects.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <div className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                  {selectedProject?.name ?? "Select project"}
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {projects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => setSelectedProject(p)}
                    className={selectedProject?.id === p.id ? "text-indigo-600 font-medium" : ""}
                  >
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Tab switcher */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 gap-0.5 ml-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      activeTab === tab.key
                        ? "bg-white/20 text-white"
                        : tab.key === "gaps"
                        ? "bg-red-100 text-red-600"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading briefs…
          </div>
        )}

        {/* ── Generated Briefs Tab ─────────────────────────────────────────── */}
        {activeTab === "briefs" && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <BriefCardSkeleton key={i} />
                ))}
              </div>
            ) : briefs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <BookOpen className="h-7 w-7 text-indigo-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No briefs generated yet</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Head to the{" "}
                  <button
                    className="text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
                    onClick={() => setActiveTab("gaps")}
                  >
                    Prompt Gaps
                  </button>{" "}
                  tab to identify where your brand is missing and generate content briefs to close those gaps.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {briefs.map((brief) => (
                  <BriefCard
                    key={brief.id}
                    brief={brief}
                    onClick={() => setSelectedBrief(brief)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Prompt Gaps Tab ──────────────────────────────────────────────── */}
        {activeTab === "gaps" && (
          <>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : selectedProject ? (
              <PromptGapsTab
                gaps={gapRows}
                projectId={selectedProject.id}
                allBrands={allBrands}
                onBriefGenerated={handleBriefGenerated}
              />
            ) : null}
          </>
        )}
      </main>

      {/* Brief detail modal */}
      {selectedBrief && (
        <BriefModal
          brief={selectedBrief}
          open={!!selectedBrief}
          onClose={() => setSelectedBrief(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
