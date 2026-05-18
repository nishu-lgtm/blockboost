import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DotBadge, type DotTone } from "@/components/ui/dot-badge";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ScoreBreakdown, DriverImpact } from "@/lib/score-breakdown";

/**
 * Score breakdown — answers "WHY is my AI Visibility score what it is?"
 *
 * Built 2026-05-16 in response to user feedback that the dashboard told
 * them the symptom (35%, then 15% after segmentation) but not the
 * components driving it. This card shows the 5 driver levers each with
 * its own 0-10 score, impact badge, plain-English "why", and a deep link
 * to the page where the user can act on it.
 *
 * Server component — receives the already-computed breakdown so the
 * Overview can fetch once and pass down.
 */

const IMPACT_STYLE: Record<DriverImpact, { bar: string; text: string; tone: DotTone; label: string }> = {
  critical: { bar: "bg-red-500",     text: "text-red-600",     tone: "critical", label: "Critical" },
  high:     { bar: "bg-amber-500",   text: "text-amber-600",   tone: "high",     label: "High impact" },
  medium:   { bar: "bg-slate-400",   text: "text-slate-600",   tone: "medium",   label: "Medium" },
  low:      { bar: "bg-emerald-500", text: "text-emerald-600", tone: "low",      label: "Low impact" },
};

const DRIVER_LINKS: Record<string, string> = {
  "Unbranded discovery":     "/dashboard/ai-visibility",
  "Branded recall":          "/dashboard/ai-visibility",
  "Owned-URL citations":     "/dashboard/citations",
  "Brand knowledge depth":   "/dashboard/entities",
  "Retrieval readiness":     "/dashboard/audit",
};

export function ScoreBreakdownCard({ breakdown }: { breakdown: ScoreBreakdown }) {
  const drivers = breakdown.drivers;
  const totalHasData = drivers.filter((d) => d.hasData).length;
  if (totalHasData === 0) {
    return null; // Pre-scan — Overview's other empty states handle this
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">
          Why your score is what it is
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          The 5 drivers behind your AI Visibility headline — sorted by impact, weakest first.
        </p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {drivers.map((d) => {
          const style = IMPACT_STYLE[d.impact];
          const href = DRIVER_LINKS[d.label] ?? "/dashboard";
          const pct = d.hasData ? d.score * 10 : 0;
          return (
            <Link
              key={d.label}
              href={href}
              className="block p-3 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center gap-4">
                {/* Score bar */}
                <div className="w-14 shrink-0">
                  <div className="flex items-baseline gap-0.5">
                    <span className={`text-lg font-semibold tabular-nums ${style.text}`}>
                      {d.hasData ? d.score : "—"}
                    </span>
                    <span className="text-xs text-slate-400">/10</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                    {d.hasData && (
                      <div
                        className={`h-full ${style.bar} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                </div>

                {/* Driver text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-0.5">
                    <p className="text-sm font-semibold text-slate-900">{d.label}</p>
                    <DotBadge tone={style.tone}>{style.label}</DotBadge>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{d.why}</p>
                  <p className={`text-[11px] mt-0.5 ${d.hasData ? "text-slate-500" : "text-slate-400 italic"}`}>
                    {d.detail}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
