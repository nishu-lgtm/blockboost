/**
 * DotBadge — minimal status indicator. Replaces pill-style colored badges
 * that previously shouted "Critical" / "High impact" / "Medium" with bold
 * fills.
 *
 * Apple-style restraint: a single 6px colored dot does the meaning-carrying;
 * the label sits in slate text beside it. Color alone differentiates state.
 *
 * Use for:
 *   - score-breakdown driver impact (critical/high/medium/low)
 *   - mention "cited" / "not cited" indicators in tables
 *   - segment "Critical" / "Medium" / "Strong" markers
 *   - any state badge that today uses a filled pill
 *
 * Do NOT use for: action buttons, links, or anything clickable.
 */
import { cn } from "@/lib/utils";

export type DotTone = "critical" | "high" | "medium" | "low" | "strong" | "neutral";

const TONE_CLASSES: Record<DotTone, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-slate-400",
  low: "bg-emerald-500",
  strong: "bg-emerald-500",
  neutral: "bg-slate-300",
};

interface DotBadgeProps {
  tone: DotTone;
  children: React.ReactNode;
  className?: string;
}

export function DotBadge({ tone, children, className }: DotBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-slate-600 font-normal",
        className
      )}
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full shrink-0", TONE_CLASSES[tone])}
      />
      {children}
    </span>
  );
}
