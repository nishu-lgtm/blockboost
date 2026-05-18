/**
 * StatStrip — 4 inline stat tiles, no card backgrounds, just numbers + labels.
 *
 * Apple-style: secondary metrics get spatial separation, not visual weight.
 * Each stat reads as a fact, not a "card" — divider lines between them
 * (1px borders) replace the previous shaded card backgrounds.
 *
 * Sits below the HeroCard on Overview. Holds the metrics that used to
 * have their own full cards (Total Scans, AI Models Tracked, Competitors,
 * Unbranded Discovery %).
 */
import { cn } from "@/lib/utils";

interface Stat {
  /** Short label below the value, e.g. "Total Scans". */
  label: string;
  /** The number itself — string-formatted (e.g. "1,234", "67%", "—"). */
  value: string;
  /** Optional one-liner under the label (e.g. "across 2 platforms"). */
  hint?: string;
}

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
        {stats.map((s, i) => (
          <div
            key={i}
            className={cn(
              "px-6 py-5",
              // First two on mobile stack with bottom border; remove on md+
              i < 2 && "border-b border-slate-100 md:border-b-0"
            )}
          >
            <p className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
              {s.value}
            </p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            {s.hint && (
              <p className="text-[11px] text-slate-400 mt-0.5">{s.hint}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
