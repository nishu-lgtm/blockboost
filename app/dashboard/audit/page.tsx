"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Wrench,
  Search,
  Clock,
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { AuditResults } from "@/components/audit/audit-results";
import { SchemaGenerator } from "@/components/audit/schema-generator";
import type { AuditResult } from "@/lib/audit-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentAuditRow {
  id: string;
  url: string;
  overallScore: number;
  crawlabilityScore: number;
  schemaScore: number;
  contentScore: number;
  authorityScore: number;
  auditedAt: string;
  createdAt: string;
  rawData: unknown;
  recommendations: unknown;
  schemaTypesFound: string[];
  robotsTxtBlocking: boolean;
}

type ActiveTab = "audit" | "schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(s: number) {
  if (s >= 70) return { bg: "bg-green-100", text: "text-green-700" };
  if (s >= 40) return { bg: "bg-amber-100", text: "text-amber-700" };
  return { bg: "bg-red-100", text: "text-red-600" };
}

function normaliseUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

// Reconstruct a full AuditResult from a stored DB row
function rowToResult(row: RecentAuditRow): AuditResult {
  const raw = row.rawData as {
    crawlability?: AuditResult["crawlability"];
    schema?: AuditResult["schema"];
    content?: AuditResult["content"];
    authority?: AuditResult["authority"];
  } | null;

  // Build minimal valid sections if raw data is missing
  const emptyCheck = (id: string, label: string) => ({
    id, label, passed: true, detail: "Data from stored audit.",
  });

  return {
    id: row.id,
    url: row.url,
    auditedAt: row.auditedAt ?? row.createdAt,
    overallScore: row.overallScore,
    crawlabilityScore: row.crawlabilityScore,
    schemaScore: row.schemaScore,
    contentScore: row.contentScore,
    authorityScore: row.authorityScore,
    crawlability: raw?.crawlability ?? {
      score: row.crawlabilityScore,
      robotsTxtBlocking: row.robotsTxtBlocking,
      blockedBots: [],
      aiCrawlerAccess: emptyCheck("ai-crawlers", "AI crawlers allowed"),
      httpsEnabled: emptyCheck("https", "HTTPS enabled"),
      pageSpeed: { ...emptyCheck("page-speed", "Page load speed"), lcp: undefined, fcp: undefined, ttfb: undefined },
      jsRequired: emptyCheck("js-rendering", "Content visible without JavaScript"),
    },
    schema: raw?.schema ?? {
      score: row.schemaScore,
      typesFound: row.schemaTypesFound,
      typesChecked: row.schemaTypesFound.map((t) => ({ type: t, present: true, recommendation: "" })),
      rawSchemas: [],
    },
    content: raw?.content ?? {
      score: row.contentScore,
      wordCount: 0,
      readingLevel: "—",
      directAnswer: emptyCheck("direct-answer", "Direct answer"),
      questionHeadings: emptyCheck("question-headings", "Question headings"),
      faqSection: emptyCheck("faq-section", "FAQ section"),
      factDensity: emptyCheck("fact-density", "Fact density"),
    },
    authority: raw?.authority ?? {
      score: row.authorityScore,
      authorBio: emptyCheck("author-bio", "Author bio"),
      externalLinks: { ...emptyCheck("external-links", "External links"), count: 0 },
      publicationDate: emptyCheck("pub-date", "Publication date"),
      socialProof: emptyCheck("social-proof", "Social proof"),
    },
    recommendations: Array.isArray(row.recommendations) ? row.recommendations as AuditResult["recommendations"] : [],
  };
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AuditPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<ActiveTab>("audit");
  const [urlInput, setUrlInput] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [recentAudits, setRecentAudits] = useState<RecentAuditRow[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load project context
  useEffect(() => {
    fetch("/api/projects/list")
      .then((r) => r.json())
      .then((list: Array<{ id: string; brandName: string }>) => {
        if (list.length > 0) {
          setProjectId(list[0].id);
          setBrandName(list[0].brandName);
        }
      })
      .catch(() => {});
  }, []);

  const loadRecent = useCallback(async (pid: string) => {
    setLoadingRecent(true);
    try {
      const res = await fetch(`/api/audit/recent?projectId=${pid}`);
      if (res.ok) setRecentAudits(await res.json());
    } catch {
      // silently skip
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    if (projectId) loadRecent(projectId);
  }, [projectId, loadRecent]);

  async function handleRunAudit(urlToAudit?: string) {
    const url = normaliseUrl(urlToAudit ?? urlInput);
    if (!url || !projectId) return;
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const res = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, projectId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Audit failed");
      }
      const data = await res.json() as AuditResult;
      setResult(data);
      setUrlInput(url);
      // Refresh recent audits
      loadRecent(projectId);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Audit failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleRunAudit();
  }

  return (
    <div className="flex flex-col flex-1">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">AEO Audit Tool</h1>
              <p className="text-xs text-slate-500">
                Audit any URL for AI Engine Optimization readiness
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            {(["audit", "schema"] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                  activeTab === tab
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab === "audit" ? "Audit URL" : "Schema Generator"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 p-6 max-w-4xl w-full mx-auto space-y-6">

        {activeTab === "schema" ? (
          <SchemaGenerator brandName={brandName} />
        ) : (
          <>
            {/* ── URL input card ──────────────────────────────────────── */}
            <Card className="border-slate-200">
              <CardContent className="p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    Enter a URL to audit
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    Works on any publicly accessible page — your own pages, competitors&apos; pages, or landing pages you&apos;re evaluating.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        ref={inputRef}
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="https://example.com/your-page"
                        className="pl-9 h-11 border-slate-300 text-sm"
                        disabled={running}
                      />
                    </div>
                    <Button
                      onClick={() => handleRunAudit()}
                      disabled={running || !urlInput.trim() || !projectId}
                      className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shrink-0"
                    >
                      {running ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wrench className="h-4 w-4" />
                      )}
                      {running ? "Auditing…" : "Run Audit"}
                    </Button>
                  </div>
                </div>

                {/* What we check chips */}
                <div className="flex flex-wrap gap-1.5">
                  {["robots.txt", "Schema markup", "PageSpeed", "HTTPS", "Content structure", "Authority signals", "AI crawlers"].map((item) => (
                    <span key={item} className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-medium">
                      {item}
                    </span>
                  ))}
                </div>

                {runError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{runError}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Running indicator ───────────────────────────────────── */}
            {running && (
              <Card className="border-indigo-200 bg-indigo-50">
                <CardContent className="p-5 flex items-center gap-4">
                  <Loader2 className="h-5 w-5 text-indigo-600 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-800">Running audit…</p>
                    <p className="text-xs text-indigo-600">
                      Fetching page, checking robots.txt, running PageSpeed analysis, and analysing content. This takes 15–30 seconds.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Audit results ───────────────────────────────────────── */}
            {result && !running && (
              <AuditResults result={result} projectId={projectId ?? ""} brandName={brandName} />
            )}

            {/* ── Recent audits ───────────────────────────────────────── */}
            {!result && !running && (
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    Recent Audits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingRecent ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse rounded-lg bg-slate-100 h-14 w-full" />
                      ))}
                    </div>
                  ) : recentAudits.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center gap-2">
                      <Wrench className="h-8 w-8 text-slate-200" />
                      <p className="text-sm text-slate-400">No audits yet. Enter a URL above to run your first audit.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentAudits.map((row) => {
                        const colors = scoreColor(row.overallScore);
                        return (
                          <button
                            key={row.id}
                            onClick={() => setResult(rowToResult(row))}
                            className="w-full flex items-center gap-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-200 p-3 transition-all text-left group"
                          >
                            {/* Score badge */}
                            <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${colors.bg} ${colors.text}`}>
                              {row.overallScore}
                            </span>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-slate-700 truncate">
                                  {row.url.replace(/^https?:\/\//, "")}
                                </p>
                                <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[11px] text-slate-400">
                                  {new Date(row.createdAt).toLocaleDateString("en-US", {
                                    month: "short", day: "numeric", year: "numeric",
                                  })}
                                </p>
                                {[
                                  { label: "Crawl", s: row.crawlabilityScore },
                                  { label: "Schema", s: row.schemaScore },
                                  { label: "Content", s: row.contentScore },
                                ].map(({ label, s }) => {
                                  const c = scoreColor(s);
                                  return (
                                    <Badge key={label} variant="outline" className={`text-[9px] px-1 py-0 ${c.bg} ${c.text} border-transparent`}>
                                      {label} {s}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>

                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Back button when viewing a result */}
            {result && (
              <Button
                variant="outline"
                onClick={() => setResult(null)}
                className="border-slate-300 text-slate-600 text-sm"
              >
                ← Run another audit
              </Button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
