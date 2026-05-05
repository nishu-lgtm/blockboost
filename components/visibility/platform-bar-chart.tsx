"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { PlatformRate } from "@/lib/visibility-types";

const PLATFORM_COLORS: Record<string, string> = {
  ChatGPT: "#16a34a",       // green-600
  Perplexity: "#2563eb",    // blue-600
  Gemini: "#4f46e5",        // indigo-600
  Copilot: "#0891b2",       // cyan-600
  Grok: "#7c3aed",          // violet-600
  "Google AIO": "#dc2626",  // red-600
};

interface Props {
  data: PlatformRate[];
  competitorAvg?: number; // optional reference line
}

export function PlatformBarChart({ data, competitorAvg }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        No scan data yet. Run a scan to see results.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="platform"
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value}%`, name]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
          }}
          cursor={{ fill: "rgba(99,102,241,0.06)" }}
        />
        {competitorAvg !== undefined && (
          <ReferenceLine
            y={competitorAvg}
            stroke="#94a3b8"
            strokeDasharray="6 3"
            label={{
              value: `Competitor avg ${competitorAvg}%`,
              position: "insideTopRight",
              fontSize: 11,
              fill: "#94a3b8",
            }}
          />
        )}
        <Bar dataKey="rate" name="Mention Rate" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((entry) => (
            <Cell
              key={entry.platform}
              fill={PLATFORM_COLORS[entry.platform] ?? "#6366f1"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
