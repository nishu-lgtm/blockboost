"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Zap,
  ArrowRight,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

interface AuditResult {
  url: string;
  score: number;
  isHttps: boolean;
  hasFaqSchema: boolean;
  hasOrganizationSchema: boolean;
  hasArticleSchema: boolean;
  hasFaqSection: boolean;
  hasAuthorBio: boolean;
  hasPublicationDate: boolean;
  questionHeadings: number;
  wordCount: number;
  schemaTypes: string[];
  recommendations: Array<{
    priority: "high" | "medium" | "low";
    issue: string;
    action: string;
    impact: number;
  }>;
}

export default function DemoAuditPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/audit/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't audit that URL.");
      } else {
        setResult(data as AuditResult);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
        <Link
          href="/auth/signup"
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Start free trial
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3">
            Free · No signup required
          </p>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            Audit your AI visibility
          </h1>
          <p className="text-lg text-slate-600">
            Find out how visible your site is to ChatGPT, Perplexity, and Google AI Overviews.
            Get specific fixes in 5 seconds.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 p-2 flex gap-2 mb-6 shadow-sm"
        >
          <input
            type="text"
            placeholder="https://yourwebsite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="flex-1 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none rounded-xl"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-6 rounded-xl transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Auditing…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run audit
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-800">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Score */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <p className="text-sm font-medium text-slate-500 mb-2">
                AEO score for {result.url}
              </p>
              <div className="text-6xl font-bold text-amber-500 mb-2">
                {result.score}
                <span className="text-2xl text-slate-300">/100</span>
              </div>
              <p className="text-sm text-slate-600">
                {result.score >= 80
                  ? "Excellent — your site is well-optimized for AI."
                  : result.score >= 60
                  ? "Good — some easy wins available."
                  : result.score >= 40
                  ? "Needs work — significant gaps in AI visibility."
                  : "Major opportunity — AI models likely don't cite your site yet."}
              </p>
            </div>

            {/* Quick checks */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Quick checks</h2>
              <div className="space-y-2">
                <CheckRow label="Site served over HTTPS" passed={result.isHttps} />
                <CheckRow label="FAQPage schema present" passed={result.hasFaqSchema} />
                <CheckRow label="Organization schema present" passed={result.hasOrganizationSchema} />
                <CheckRow label="Article schema present" passed={result.hasArticleSchema} />
                <CheckRow label="FAQ section on page" passed={result.hasFaqSection} />
                <CheckRow label="Author bio detected" passed={result.hasAuthorBio} />
                <CheckRow label="Publication date visible" passed={result.hasPublicationDate} />
                <CheckRow
                  label={`${result.questionHeadings} question-style headings`}
                  passed={result.questionHeadings >= 2}
                />
                <CheckRow
                  label={`${result.wordCount.toLocaleString()} words on page`}
                  passed={result.wordCount >= 300}
                />
              </div>
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">
                  Top {result.recommendations.length} fixes
                </h2>
                <div className="space-y-4">
                  {result.recommendations.map((rec, i) => {
                    const colorMap = {
                      high: "text-red-500",
                      medium: "text-amber-500",
                      low: "text-slate-400",
                    };
                    const Icon = rec.priority === "high" ? AlertCircle : CheckCircle2;
                    return (
                      <div key={i} className="flex gap-3">
                        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${colorMap[rec.priority]}`} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900 mb-0.5">
                            {rec.issue}
                          </p>
                          <p className="text-sm text-slate-600 leading-relaxed">{rec.action}</p>
                          <p className="text-xs text-slate-400 mt-1.5 font-medium">
                            Impact: +{rec.impact} points
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upsell CTA */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-8 text-white text-center">
              <Zap className="w-8 h-8 mx-auto mb-3" />
              <h3 className="text-xl font-bold mb-2">
                Want the full audit?
              </h3>
              <p className="opacity-90 mb-5 text-sm">
                Sign up free to get AI-powered content analysis, PageSpeed metrics,
                auto-generated schema markup, and weekly visibility tracking across
                ChatGPT, Perplexity, and Google AI Overviews.
              </p>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 bg-white text-amber-600 font-bold px-6 py-3 rounded-xl hover:bg-amber-50 transition-colors"
              >
                Get the full audit — free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-xs opacity-75 mt-3">
                14-day trial · No credit card required
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
      {passed ? (
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
      )}
      <p className={`text-sm ${passed ? "text-slate-700" : "text-slate-500"}`}>
        {label}
      </p>
    </div>
  );
}
