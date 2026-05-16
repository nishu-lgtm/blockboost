"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag, Globe2, AlertCircle, CheckCircle2 } from "lucide-react";
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

function rateTone(rate: number): { color: string; bg: string; label: string } {
  if (rate >= 60) return { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", label: "Strong" };
  if (rate >= 30) return { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "Medium" };
  if (rate > 0) return { color: "text-red-600", bg: "bg-red-50 border-red-200", label: "Low" };
  return { color: "text-red-700", bg: "bg-red-50 border-red-300", label: "Critical" };
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
        <CardTitle className="text-base flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-indigo-500" />
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
        <div className={`rounded-lg border p-4 ${weightedTone.bg}`}>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide font-medium text-slate-500">
                Weighted AI Visibility Score
              </p>
              <p className={`text-3xl font-bold mt-1 ${weightedTone.color}`}>
                {weightedScore}<span className="text-base text-slate-400 ml-1">/100</span>
              </p>
            </div>
            <Badge variant="outline" className={`${weightedTone.bg} ${weightedTone.color} border`}>
              {weightedTone.label}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            70% unbranded discovery · 30% branded recall.
          </p>
        </div>

        {/* Two segment cards side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Unbranded — the harder, more meaningful signal */}
          <div className={`rounded-lg border p-3 ${unbrandedTone.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Globe2 className={`h-4 w-4 ${unbrandedTone.color}`} />
              <p className="text-sm font-semibold text-slate-800">Unbranded discovery</p>
              <Badge variant="outline" className={`ml-auto ${unbrandedTone.color} text-xs`}>
                {unbrandedTone.label}
              </Badge>
            </div>
            {unbranded.totalScans === 0 ? (
              <p className="text-xs text-slate-500">
                No unbranded prompts tracked yet. Add generic competitive queries to measure real AI discovery.
              </p>
            ) : (
              <>
                <p className={`text-2xl font-bold ${unbrandedTone.color} tabular-nums`}>
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
          <div className={`rounded-lg border p-3 ${brandedTone.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Tag className={`h-4 w-4 ${brandedTone.color}`} />
              <p className="text-sm font-semibold text-slate-800">Branded recall</p>
              <Badge variant="outline" className={`ml-auto ${brandedTone.color} text-xs`}>
                {brandedTone.label}
              </Badge>
            </div>
            {branded.totalScans === 0 ? (
              <p className="text-xs text-slate-500">
                No branded prompts tracked. Add a few that include &ldquo;{brandName}&rdquo; to measure recall.
              </p>
            ) : (
              <>
                <p className={`text-2xl font-bold ${brandedTone.color} tabular-nums`}>
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
          <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs text-red-900">
              <p className="font-semibold mb-0.5">
                Branded recall {branded.mentionRate}% · Unbranded discovery 0%
              </p>
              <p className="text-red-800/90">
                When customers don&apos;t already know &ldquo;{brandName}&rdquo;, AI never recommends you.
                Fixing this is the single highest-leverage move for AI visibility — see
                content-briefs &amp; entity-graph recommendations.
              </p>
            </div>
          </div>
        )}

        {unbranded.totalScans > 0 && unbranded.mentionRate >= 30 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-900">
              Real AI discovery working — {brandName} surfaces in {unbranded.mentionRate}% of unbranded queries.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
