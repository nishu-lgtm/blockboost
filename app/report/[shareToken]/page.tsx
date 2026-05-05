/**
 * Public shared report page — no authentication required.
 * Renders a clean web view of the report data with a "Powered by VisibilityIQ" watermark.
 */

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import type { ReportData } from "@/lib/report-compiler";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Download,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}): Promise<Metadata> {
  const { shareToken } = await params;
  const report = await prisma.report.findUnique({
    where: { shareToken },
    include: { project: { select: { brandName: true } } },
  });
  if (!report) return { title: "Report not found" };
  return {
    title: `AI Visibility Report — ${report.project.brandName}`,
    description: `AI Visibility Report for ${report.project.brandName}. Powered by VisibilityIQ.`,
    openGraph: {
      title: `AI Visibility Report — ${report.project.brandName}`,
      description: "See how this brand performs across ChatGPT, Gemini, Perplexity, and more.",
      siteName: "VisibilityIQ",
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  const report = await prisma.report.findUnique({
    where: { shareToken },
    include: {
      project: { select: { brandName: true, name: true } },
    },
  });

  if (!report) notFound();

  // Increment view count (fire and forget)
  prisma.report
    .update({ where: { id: report.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  const data = report.data as unknown as ReportData;
  const es = data.executiveSummary;

  const periodLabel = data.period?.label ?? "—";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900">VisibilityIQ</span>
        </div>
        <div className="flex items-center gap-3">
          {report.pdfUrl && (
            <a
              href={report.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
          )}
          <a
            href="https://visibilityiq.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Get your own report
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
            AI Visibility Report
          </span>
          <h1 className="text-4xl font-bold text-slate-900">
            {report.project.brandName}
          </h1>
          <p className="text-slate-500 text-lg">{periodLabel}</p>
          <p className="text-slate-400 text-sm">
            Generated {new Date(report.createdAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Mention Rate"
            value={`${es.overallMentionRate}%`}
            change={es.mentionRateChange}
          />
          <MetricCard
            label="Share of Voice"
            value={`${es.shareOfVoice}%`}
            change={es.shareOfVoiceChange}
          />
          <MetricCard
            label="Citations Found"
            value={String(es.totalCitationsFound)}
            sub={`${es.ownedCitationRate}% owned`}
          />
          <MetricCard
            label="Prompts Tracked"
            value={String(es.totalPromptsTracked)}
            sub={`${es.platformsTracked.length} platforms`}
          />
        </div>

        {/* Narrative */}
        <div className="bg-indigo-50 rounded-2xl p-6">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-3">
            AI-Generated Insight
          </p>
          <p className="text-slate-700 text-base leading-relaxed">{es.narrative}</p>
        </div>

        {/* Platform performance */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Platform Performance</h2>
          <div className="space-y-5">
            {data.platformBreakdown.map((p) => {
              const diff = p.mentionRateChange;
              return (
                <div key={p.platform} className="flex items-center gap-4">
                  <span className="w-28 text-sm font-semibold text-slate-700 shrink-0">
                    {p.platform}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, p.mentionRate)}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-bold text-indigo-600 text-right shrink-0">
                    {p.mentionRate}%
                  </span>
                  <span
                    className={`w-14 text-xs font-semibold text-right shrink-0 ${
                      diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-slate-400"
                    }`}
                  >
                    {diff === 0 ? "—" : diff > 0 ? `+${diff}pp` : `${diff}pp`}
                  </span>
                </div>
              );
            })}
            {data.platformBreakdown.length === 0 && (
              <p className="text-slate-400 text-sm">No platform data available.</p>
            )}
          </div>
        </section>

        {/* Wins & Gaps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Wins */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">✓ Top Wins</h2>
            <div className="space-y-3">
              {data.topWins.slice(0, 4).map((w, i) => (
                <div key={i} className="bg-green-50 rounded-xl p-3 border-l-4 border-green-500">
                  <p className="text-sm font-semibold text-slate-900 line-clamp-2">{w.prompt}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {w.mentionRate}% · {w.platforms.join(", ")}
                  </p>
                </div>
              ))}
              {data.topWins.length === 0 && (
                <p className="text-slate-400 text-sm">No wins recorded this period.</p>
              )}
            </div>
          </div>

          {/* Gaps */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">⚠ Top Gaps</h2>
            <div className="space-y-3">
              {data.topGaps.slice(0, 4).map((g, i) => (
                <div key={i} className="bg-red-50 rounded-xl p-3 border-l-4 border-red-400">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full mb-1 inline-block ${
                      g.priority === "high"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {g.priority === "high" ? "High Priority" : "Medium Priority"}
                  </span>
                  <p className="text-sm font-semibold text-slate-900 line-clamp-2">{g.prompt}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {g.competitorsAppearing.length > 0
                      ? `Competitors: ${g.competitorsAppearing.slice(0, 2).join(", ")}`
                      : "No mention detected"}
                  </p>
                </div>
              ))}
              {data.topGaps.length === 0 && (
                <p className="text-slate-400 text-sm">No gaps identified this period.</p>
              )}
            </div>
          </div>
        </div>

        {/* Action Roadmap */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Action Roadmap</h2>
          <div className="space-y-4">
            {data.actionRoadmap.map((item) => (
              <div
                key={item.priority}
                className="flex items-start gap-4 bg-slate-50 rounded-xl p-4"
              >
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {item.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.detail}</p>
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        item.impact === "High"
                          ? "bg-red-100 text-red-700"
                          : item.impact === "Medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      Impact: {item.impact}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Effort: {item.effort}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Competitor comparison */}
        {data.competitorComparison.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Competitor Comparison</h2>
            <div className="space-y-4">
              {/* Your brand first */}
              <div className="flex items-center gap-4 bg-indigo-50 rounded-xl px-4 py-3">
                <span className="w-28 text-sm font-bold text-indigo-700 shrink-0">
                  {data.project.brandName} (you)
                </span>
                <div className="flex-1 bg-indigo-100 rounded-full h-2.5">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full"
                    style={{ width: `${Math.min(100, es.overallMentionRate)}%` }}
                  />
                </div>
                <span className="w-12 text-sm font-bold text-indigo-600 text-right shrink-0">
                  {es.overallMentionRate}%
                </span>
              </div>
              {data.competitorComparison.map((c, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="w-28 text-sm font-semibold text-slate-700 shrink-0">
                    {c.brandName}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                    <div
                      className="bg-slate-400 h-2.5 rounded-full"
                      style={{ width: `${Math.min(100, c.mentionRate)}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-bold text-slate-700 text-right shrink-0">
                    {c.mentionRate}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="bg-indigo-600 rounded-2xl p-8 text-center text-white">
          <Zap className="w-10 h-10 mx-auto mb-4 text-indigo-200" />
          <h2 className="text-2xl font-bold mb-2">Get your own AI visibility report</h2>
          <p className="text-indigo-200 mb-6">
            Track your brand across ChatGPT, Gemini, Perplexity and more. Start free.
          </p>
          <a
            href="https://visibilityiq.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-indigo-700 font-bold px-8 py-3 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            Try VisibilityIQ free →
          </a>
        </div>

        {/* Watermark */}
        <p className="text-center text-slate-400 text-xs pb-8">
          Powered by{" "}
          <a
            href="https://visibilityiq.app"
            className="text-indigo-500 hover:underline"
          >
            VisibilityIQ
          </a>{" "}
          · AI Visibility Intelligence
        </p>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  change,
  sub,
}: {
  label: string;
  value: string;
  change?: number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-indigo-600">{value}</p>
      {change !== undefined && (
        <p
          className={`text-xs font-semibold mt-1 flex items-center gap-1 ${
            change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-slate-400"
          }`}
        >
          {change > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : change < 0 ? (
            <TrendingDown className="w-3 h-3" />
          ) : null}
          {change === 0 ? "No change" : `${change > 0 ? "+" : ""}${change}pp vs prior`}
        </p>
      )}
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
