"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { SentimentBreakdown } from "@/lib/visibility-types";

const SENTIMENT_COLORS = {
  Positive: "#16a34a",  // green-600
  Neutral: "#64748b",   // slate-500
  Negative: "#dc2626",  // red-600
};

interface Props {
  data: SentimentBreakdown;
}

export function SentimentPieChart({ data }: Props) {
  const total = data.positive + data.neutral + data.negative;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-slate-400">
        No brand mentions yet.
      </div>
    );
  }

  const chartData = [
    { name: "Positive", value: data.positive },
    { name: "Neutral", value: data.neutral },
    { name: "Negative", value: data.negative },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={42}
            outerRadius={64}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={SENTIMENT_COLORS[entry.name as keyof typeof SENTIMENT_COLORS]}
              />
            ))}
          </Pie>
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [
              `${value} (${Math.round((value / total) * 100)}%)`,
            ]}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend + stats */}
      <div className="space-y-2 flex-1">
        {[
          { label: "Positive", value: data.positive, color: SENTIMENT_COLORS.Positive },
          { label: "Neutral", value: data.neutral, color: SENTIMENT_COLORS.Neutral },
          { label: "Negative", value: data.negative, color: SENTIMENT_COLORS.Negative },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-slate-600">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{item.value}</span>
              <span className="text-xs text-slate-400 w-10 text-right">
                {total > 0 ? `${Math.round((item.value / total) * 100)}%` : "—"}
              </span>
            </div>
          </div>
        ))}
        <p className="text-xs text-slate-400 pt-1">
          Based on {total} brand mention{total !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
