/**
 * Static demo report page — visible without authentication.
 * Linked from the marketing landing page ("See a sample report").
 *
 * This is a hand-crafted preview that doesn't hit the database, so it
 * always loads instantly and stays consistent regardless of seed data.
 */

import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export const metadata = {
  title: "Sample AI Visibility Report — BlockBoost",
  description:
    "See what a BlockBoost AI Visibility Report looks like. Track your brand across ChatGPT, Perplexity, and Google AI Overviews.",
};

export default function DemoReportPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-1.5">
          <Zap className="w-5 h-5 text-amber-500" />
          <span className="text-lg font-bold">
            <span className="text-slate-900">Block</span>
            <span className="text-amber-500">Boost</span>
          </span>
        </Link>
        <Link
          href="/auth/signup"
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Start your own report — free
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Demo banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <Zap className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900">
            <strong>This is a sample report.</strong> Sign up free to generate
            real reports for your own brand.
          </p>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
                AI Visibility Report
              </p>
              <h1 className="text-3xl font-bold text-slate-900">
                Acme Local Plumbers
              </h1>
              <p className="text-slate-500 mt-1">acmeplumbers.example.com · Mumbai</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Period</p>
              <p className="text-sm font-semibold text-slate-700">Last 30 days</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="AI Visibility Score" value="62%" delta="+18%" />
            <Stat label="Total Mentions" value="312" delta="+44%" />
            <Stat label="Citations" value="47" delta="+12%" />
            <Stat label="Competitor Gap" value="8 prompts" delta={null} />
          </div>
        </div>

        {/* Executive summary */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-3">
            Executive Summary
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Acme Local Plumbers is mentioned in 62% of AI responses for the 24
            tracked prompts in the &ldquo;Mumbai plumbing&rdquo; category — up
            from 44% last month. The biggest gain came from ChatGPT (+22pp),
            driven by improved schema markup on the homepage. Perplexity still
            lags at 38%, primarily because the brand lacks third-party
            citations from local directories.
          </p>
        </div>

        {/* Platform breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Platform Breakdown
          </h2>
          <div className="space-y-3">
            <PlatformRow name="ChatGPT" rate={78} delta={22} />
            <PlatformRow name="Google AI Overviews" rate={70} delta={9} />
            <PlatformRow name="Perplexity" rate={38} delta={-3} />
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Top recommendations
          </h2>
          <div className="space-y-4">
            <Rec
              kind="high"
              issue="No FAQ section on top 3 service pages"
              action="Add an FAQ block with 5-10 common questions and pair with FAQPage JSON-LD schema."
              impact={12}
            />
            <Rec
              kind="medium"
              issue="Missing Organization schema on homepage"
              action="Add Organization JSON-LD with name, address, phone, and service area."
              impact={8}
            />
            <Rec
              kind="medium"
              issue="No author bio on blog posts"
              action="Add a short author bio + credentials block at the top of each article."
              impact={8}
            />
          </div>
        </div>

        {/* Top prompts */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Top performing prompts
          </h2>
          <div className="divide-y divide-slate-100">
            <PromptRow text="best emergency plumber in Mumbai" rate={92} />
            <PromptRow text="how much does a plumber cost in Mumbai" rate={75} />
            <PromptRow text="24/7 plumbing service near me" rate={68} />
            <PromptRow text="leak repair Mumbai recommendations" rate={54} />
            <PromptRow text="affordable bathroom plumber Mumbai" rate={31} />
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-10 text-center text-white">
          <Zap className="w-10 h-10 mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">
            See your own AI visibility — free
          </h3>
          <p className="opacity-90 mb-6">
            14-day trial. No credit card. Set up in 2 minutes.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block bg-white text-amber-600 font-bold px-8 py-3 rounded-xl hover:bg-amber-50 transition-colors"
          >
            Get my free report →
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-8">
          Powered by{" "}
          <Link href="/" className="font-semibold text-amber-600 hover:underline">
            BlockBoost
          </Link>{" "}
          · AI Visibility for Local Businesses
        </p>
      </div>
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string | null;
}) {
  const positive = delta && delta.startsWith("+");
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {delta && (
        <p
          className={`text-xs mt-1 flex items-center gap-1 font-semibold ${
            positive ? "text-green-600" : "text-red-500"
          }`}
        >
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {delta} vs last month
        </p>
      )}
    </div>
  );
}

function PlatformRow({
  name,
  rate,
  delta,
}: {
  name: string;
  rate: number;
  delta: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-semibold text-slate-700">{name}</p>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-slate-900">{rate}%</span>
          <span
            className={`text-xs font-semibold ${
              delta >= 0 ? "text-green-600" : "text-red-500"
            }`}
          >
            {delta > 0 && "+"}
            {delta}pp
          </span>
        </div>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full"
          style={{ width: `${rate}%` }}
        />
      </div>
    </div>
  );
}

function Rec({
  kind,
  issue,
  action,
  impact,
}: {
  kind: "high" | "medium" | "low";
  issue: string;
  action: string;
  impact: number;
}) {
  const Icon = kind === "high" ? AlertCircle : CheckCircle2;
  const color =
    kind === "high"
      ? "text-red-500"
      : kind === "medium"
      ? "text-amber-500"
      : "text-slate-400";
  return (
    <div className="flex gap-3">
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${color}`} />
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900 mb-0.5">{issue}</p>
        <p className="text-sm text-slate-600 leading-relaxed">{action}</p>
        <p className="text-xs text-slate-400 mt-1.5 font-medium">
          Impact: +{impact} points
        </p>
      </div>
    </div>
  );
}

function PromptRow({ text, rate }: { text: string; rate: number }) {
  return (
    <div className="flex items-center justify-between py-3 gap-4">
      <p className="text-sm text-slate-700 flex-1">&ldquo;{text}&rdquo;</p>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full"
            style={{ width: `${rate}%` }}
          />
        </div>
        <span className="text-sm font-bold text-slate-700 w-10 text-right">
          {rate}%
        </span>
      </div>
    </div>
  );
}

// Don't ship the BarChart3 icon export — keeps lint happy.
const _unused = BarChart3;
void _unused;
