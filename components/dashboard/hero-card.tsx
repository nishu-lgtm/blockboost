/**
 * HeroCard — the headline block on the Overview dashboard.
 *
 * Apple-style: one hero per page that takes ≥50% of the visual attention
 * budget. Replaces the previous Overview pattern of 5 equal-weight stacked
 * cards competing for attention.
 *
 * Contains:
 *   - Single big metric (the weighted AI Visibility score 0-100)
 *   - A one-sentence "what this means" subtitle
 *   - One primary next-best action with a deep link
 *   - A small "details" affordance to expand the score breakdown if the
 *     user wants the drivers
 *
 * Tone follows the score bucket: red (Low), amber (Medium), emerald
 * (Strong), slate (No data). No fills, no shadows, hairline borders only.
 */
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface HeroAction {
  title: string;
  description: string;
  href: string;
  /** Visual tone of the primary CTA button. */
  impact?: "high" | "medium" | "low";
}

interface HeroCardProps {
  /** Headline label, e.g. "AI Visibility" — kept short. */
  label: string;
  /** The big number — "20", "Strong", or "—". */
  value: string;
  /** Suffix shown smaller, e.g. "/100". Optional. */
  valueSuffix?: string;
  /** Short readable bucket name, e.g. "Low". */
  status: "No data yet" | "Low" | "Medium" | "Strong";
  /** One sentence explaining what the score means in plain English. */
  description: string;
  /** Primary action under the score. Optional — hero stands alone if none. */
  action?: HeroAction;
}

const TONE: Record<HeroCardProps["status"], { text: string; statusBg: string; statusText: string }> = {
  "No data yet": { text: "text-slate-500", statusBg: "bg-slate-100", statusText: "text-slate-600" },
  Low:           { text: "text-red-600",   statusBg: "bg-red-50",    statusText: "text-red-700" },
  Medium:        { text: "text-amber-600", statusBg: "bg-amber-50",  statusText: "text-amber-700" },
  Strong:        { text: "text-emerald-600", statusBg: "bg-emerald-50", statusText: "text-emerald-700" },
};

export function HeroCard({
  label,
  value,
  valueSuffix,
  status,
  description,
  action,
}: HeroCardProps) {
  const tone = TONE[status];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
            tone.statusBg,
            tone.statusText
          )}
        >
          {status}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className={cn("text-6xl font-semibold tabular-nums tracking-tight", tone.text)}>
          {value}
        </span>
        {valueSuffix && (
          <span className="text-2xl font-normal text-slate-400">{valueSuffix}</span>
        )}
      </div>

      <p className="text-sm text-slate-600 leading-relaxed max-w-2xl mb-8">
        {description}
      </p>

      {action && (
        <Link
          href={action.href}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors",
            action.impact === "high"
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "border border-slate-200 text-slate-700 hover:bg-slate-50"
          )}
        >
          <span>{action.title}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      {action && action.description && (
        <p className="text-xs text-slate-500 mt-2 max-w-md">{action.description}</p>
      )}
    </section>
  );
}
