"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  ArrowUpRight,
  Copy,
  Check,
  Loader2,
  Share2,
} from "lucide-react";
import { ScoreCircle } from "./score-circle";
import type { AuditResult, CheckItem, Recommendation } from "@/lib/audit-types";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function CheckRow({ item }: { item: CheckItem }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="mt-0.5 shrink-0">
        {item.passed ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">{item.label}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.detail}</p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  score,
  icon,
  children,
}: {
  title: string;
  score: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const color =
    score >= 70 ? "text-green-600" : score >= 40 ? "text-amber-600" : "text-red-600";
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <span className={`text-sm font-bold ${color}`}>{score}/100</span>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const PRIORITY_STYLE: Record<Recommendation["priority"], string> = {
  high:   "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-slate-50 text-slate-600 border-slate-200",
};

// ---------------------------------------------------------------------------
// Main results component
// ---------------------------------------------------------------------------

interface Props {
  result: AuditResult;
  projectId: string;
  brandName?: string;
}

export function AuditResults({ result, projectId, brandName }: Props) {
  const [schemaExpanded, setSchemaExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingContent, setGeneratingContent] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  async function generateContent(rec: Recommendation) {
    const id = rec.issue;
    setGeneratingContent(id);
    try {
      const res = await fetch("/api/audit/generate-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Optimize for: ${rec.issue}\nAction: ${rec.action}\nURL: ${result.url}`,
          schemaType: "Article",
          brandName,
        }),
      });
      const data = await res.json() as { schema?: string };
      if (data.schema) setGeneratedContent((prev) => ({ ...prev, [id]: data.schema! }));
    } catch {
      // silently fail
    } finally {
      setGeneratingContent(null);
    }
  }

  async function handleShare() {
    setSharing(true);
    // Generate a shareable URL using the audit report id
    const url = `${window.location.origin}/audit/report/${result.id}`;
    await copyToClipboard(url, "share");
    setShareUrl(url);
    setSharing(false);
  }

  return (
    <div className="space-y-6">
      {/* ── Score header ─────────────────────────────────────────────── */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Audited URL</p>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline font-medium"
              >
                {result.url}
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(result.auditedAt).toLocaleString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              disabled={sharing}
              className="h-8 text-xs border-slate-300 text-slate-600 gap-1.5"
            >
              {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
              {shareUrl ? "Link copied!" : "Share Report"}
            </Button>
          </div>

          {/* Scores row */}
          <div className="flex flex-wrap justify-center gap-8 lg:gap-12">
            <ScoreCircle
              score={result.overallScore}
              size="lg"
              label="AEO Readiness Score"
              animate
            />
            <div className="flex items-center gap-6 flex-wrap justify-center">
              {[
                { label: "Crawlability",    score: result.crawlabilityScore },
                { label: "Schema",          score: result.schemaScore },
                { label: "Content",         score: result.contentScore },
                { label: "Authority",       score: result.authorityScore },
              ].map((s) => (
                <ScoreCircle key={s.label} score={s.score} size="sm" label={s.label} animate />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Crawlability ─────────────────────────────────────────────── */}
      <SectionCard
        title="Crawlability"
        score={result.crawlabilityScore}
        icon={<span className="text-base">🤖</span>}
      >
        {result.crawlability.robotsTxtBlocking && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700">
              <strong>AI crawlers blocked:</strong> {result.crawlability.blockedBots.join(", ")}
              {" "}in robots.txt. These bots cannot index your content.
            </div>
          </div>
        )}
        <CheckRow item={result.crawlability.aiCrawlerAccess} />
        <CheckRow item={result.crawlability.httpsEnabled} />
        <CheckRow item={result.crawlability.pageSpeed} />
        <CheckRow item={result.crawlability.jsRequired} />
      </SectionCard>

      {/* ── Schema ───────────────────────────────────────────────────── */}
      <SectionCard
        title="Schema Markup"
        score={result.schemaScore}
        icon={<span className="text-base">🏷️</span>}
      >
        <div className="space-y-2">
          {result.schema.typesChecked.map((t) => (
            <div
              key={t.type}
              className={`flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0 ${
                !t.present ? "opacity-90" : ""
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {t.present ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-700">{t.type}</p>
                  {t.present && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">
                      Found
                    </Badge>
                  )}
                </div>
                {!t.present && (
                  <p className="text-xs text-slate-500 mt-0.5">{t.recommendation}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Raw schema display */}
        {result.schema.rawSchemas.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Found schema JSON-LD
            </p>
            {result.schema.rawSchemas.map((raw, i) => {
              const id = `schema-${i}`;
              const isOpen = schemaExpanded === id;
              let preview = raw.slice(0, 80).replace(/\n/g, " ") + "…";
              try { preview = `@type: ${(JSON.parse(raw) as { "@type"?: string })["@type"] ?? "Unknown"}`; } catch {}
              return (
                <div key={id} className="rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setSchemaExpanded(isOpen ? null : id)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <span className="font-mono">{preview}</span>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {isOpen && (
                    <div className="relative">
                      <pre className="overflow-x-auto p-3 text-[11px] font-mono text-slate-700 bg-slate-950 text-green-400 max-h-64">
                        {JSON.stringify(JSON.parse(raw), null, 2)}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(raw, id)}
                        className="absolute top-2 right-2 h-6 px-2 text-[10px] bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      >
                        {copiedId === id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Content structure ─────────────────────────────────────────── */}
      <SectionCard
        title="Content Structure"
        score={result.contentScore}
        icon={<span className="text-base">📄</span>}
      >
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Word count</p>
            <p className="text-lg font-bold text-slate-800">{result.content.wordCount.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400">
              {result.content.wordCount >= 800 ? "✓ Good length" : result.content.wordCount >= 300 ? "⚠ Could be longer" : "✗ Too short"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Reading level</p>
            <p className="text-sm font-bold text-slate-800 mt-1">{result.content.readingLevel}</p>
          </div>
        </div>
        <CheckRow item={result.content.directAnswer} />
        <CheckRow item={result.content.questionHeadings} />
        <CheckRow item={result.content.faqSection} />
        <CheckRow item={result.content.factDensity} />
      </SectionCard>

      {/* ── Authority signals ─────────────────────────────────────────── */}
      <SectionCard
        title="Authority Signals"
        score={result.authorityScore}
        icon={<span className="text-base">🏆</span>}
      >
        <CheckRow item={result.authority.authorBio} />
        <CheckRow item={result.authority.externalLinks} />
        <CheckRow item={result.authority.publicationDate} />
        <CheckRow item={result.authority.socialProof} />
      </SectionCard>

      {/* ── Recommendations ───────────────────────────────────────────── */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-indigo-500" />
            Recommendations
            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 ml-1">
              {result.recommendations.length} fixes
            </Badge>
          </CardTitle>
          <p className="text-xs text-slate-500">Sorted by priority and estimated score impact</p>
        </CardHeader>
        <CardContent>
          {result.recommendations.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
              <p className="text-sm font-medium text-slate-700">No critical issues found</p>
              <p className="text-xs text-slate-400">This page scores well across all AEO criteria.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-4 space-y-2 ${
                    rec.priority === "high"
                      ? "border-red-200 bg-red-50/50"
                      : rec.priority === "medium"
                      ? "border-amber-200 bg-amber-50/50"
                      : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_STYLE[rec.priority]}`}>
                        {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} priority
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-500 border-slate-200">
                        {rec.category}
                      </Badge>
                      <span className="text-[10px] text-green-600 font-medium">
                        +{rec.scoreImpact} pts potential
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{rec.issue}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{rec.action}</p>

                  {/* Content generation for content-category recs */}
                  {rec.category === "content" && (
                    <div className="pt-1">
                      {generatedContent[rec.issue] ? (
                        <div className="relative rounded-lg overflow-hidden border border-slate-200">
                          <pre className="p-3 text-[11px] font-mono text-green-400 bg-slate-950 max-h-48 overflow-auto whitespace-pre-wrap">
                            {generatedContent[rec.issue]}
                          </pre>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(generatedContent[rec.issue], `gen-${i}`)}
                            className="absolute top-2 right-2 h-6 px-2 text-[10px] bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                          >
                            {copiedId === `gen-${i}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={generatingContent === rec.issue}
                          onClick={() => generateContent(rec)}
                          className="h-7 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-1.5"
                        >
                          {generatingContent === rec.issue ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          Generate optimized content
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
