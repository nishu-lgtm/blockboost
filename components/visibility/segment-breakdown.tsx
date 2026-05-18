"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DotBadge, type DotTone } from "@/components/ui/dot-badge";
import type { VisibilitySegmentLite } from "@/lib/visibility-types";

/**
 * Branded vs unbranded mention-rate breakdown. The single most important
 * view on AI Visibility — it's the difference between "ChatGPT engaged with
 * a prompt that named our brand" (vanity metric) vs "ChatGPT recommended us
 * for a generic competitive query" (real discovery signal).
 *
 * Designed to be loud on the discovery number — if unbranded is 0%, the
 * UI calls it out as a critical gap rather than burying it in a stat tile.
 */

interface Props {
  branded: VisibilitySegmentLite;
  unbranded: VisibilitySegmentLite;
  weightedScore: number;
  brandName: string;
}

function rateTone(rate: number): { color: string; tone: DotTone; label: string } {
  if (rate >= 60) return { color: "text-emerald-600", tone: "strong",   label: "Strong" };
  if (rate >= 30) return { color: "text-amber-600",   tone: "high",     label: "Medium" };
  if (rate > 0)   return { color: "text-red-600",     tone: "critical", label: "Low" };
  return            { color: "text-red-600",          tone: "critical", label: "Critical" };
}

export function SegmentBreakdown({ branded, unbranded, weightedScore, brandName }: Props) {
  const brandedTone = rateTone(branded.mentionRate);
  const unbrandedTone = rateTone(unbranded.mentionRate);
  const weightedTone = rateTone(weightedScore);

  // If there are no scans yet, hide the whole section — the page already
  // shows other empty states.
  if (branded.totalScans === 0 && unbranded.totalScans === 0) return null;

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">
          Branded vs Unbranded Visibility
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          The truthful score. Branded prompts (your name in the question) inflate
          mention rate — what matters for AI-driven discovery is whether your
          brand surfaces on <span className="font-medium">generic competitive queries</span>.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weighted overall — the headline number */}
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-medium text-slate-500">
                Weighted AI Visibility Score
              </p>
              <p className={`text-3xl font-semibold mt-1 tabular-nums tracking-tight ${weightedTone.color}`}>
                {weightedScore}<span className="text-base text-slate-400 ml-1 font-normal">/100</span>
              </p>
            </div>
            <DotBadge tone={weightedTone.tone}>{weightedTone.label}</DotBadge>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            70% unbranded discovery · 30% branded recall.
          </p>
        </div>

        {/* Two segment cards side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Unbranded — the harder, more meaningful signal */}
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-semibold text-slate-900">Unbranded discovery</p>
              <span className="ml-auto">
                <DotBadge tone={unbrandedTone.tone}>{unbrandedTone.label}</DotBadge>
              </span>
            </div>
            {unbranded.totalScans === 0 ? (
              <p className="text-xs text-slate-500">
                No unbranded prompts tracked yet. Add generic competitive queries to measure real AI discovery.
              </p>
            ) : (
              <>
                <p className={`text-2xl font-semibold tabular-nums tracking-tight ${unbrandedTone.color}`}>
                  {unbranded.mentionRate}%
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {unbranded.citedScans}/{unbranded.totalScans} scans · {unbranded.promptCount} prompts
                </p>
                <p className="text-[11px] text-slate-500 mt-2">
                  {unbranded.mentionRate === 0
                    ? `${brandName} never surfaces when customers ask AI without naming your brand. This is the real visibility gap.`
                    : unbranded.mentionRate >= 30
                      ? "AI surfaces your brand even on generic queries — strong discoverability."
                      : "Limited surface on generic queries — competitors likely dominate."}
                </p>
              </>
            )}
          </div>

          {/* Branded — the engagement / recall metric */}
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-semibold text-slate-900">Branded recall</p>
              <span className="ml-auto">
                <DotBadge tone={brandedTone.tone}>{brandedTone.label}</DotBadge>
              </span>
            </div>
            {branded.totalScans === 0 ? (
              <p className="text-xs text-slate-500">
                No branded prompts tracked. Add a few that include &ldquo;{brandName}&rdquo; to measure recall.
              </p>
            ) : (
              <>
                <p className={`text-2xl font-semibold tabular-nums tracking-tight ${brandedTone.color}`}>
                  {branded.mentionRate}%
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {branded.citedScans}/{branded.totalScans} scans · {branded.promptCount} prompts
                </p>
                <p className="text-[11px] text-slate-500 mt-2">
                  How often AI engages with prompts that already name your brand — an engagement check, not discovery.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Diagnostic callout when unbranded is 0 but branded > 0 */}
        {unbranded.totalScans > 0 && unbranded.mentionRate === 0 && branded.mentionRate > 0 && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />
              <p className="text-sm font-semibold text-slate-900">
                Branded recall {branded.mentionRate}% · Unbranded discovery 0%
              </p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              When customers don&apos;t already know &ldquo;{brandName}&rdquo;, AI never recommends you.
              Fixing this is the single highest-leverage move for AI visibility.
            </p>
          </div>
        )}

        {unbranded.totalScans > 0 && unbranded.mentionRate >= 30 && (
          <div className="rounded-lg border border-slate-200 p-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
            <p className="text-xs text-slate-700">
              Real AI discovery working — {brandName} surfaces in {unbranded.mentionRate}% of unbranded queries.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
