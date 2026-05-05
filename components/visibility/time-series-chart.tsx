"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TimeSeriesPoint } from "@/lib/visibility-types";

const PLATFORM_COLORS: Record<string, string> = {
  ChatGPT: "#16a34a",
  Perplexity: "#2563eb",
  Gemini: "#4f46e5",
  Copilot: "#0891b2",
  Grok: "#7c3aed",
  "Google AIO": "#dc2626",
};

interface Props {
  data: TimeSeriesPoint[];
  platforms: string[];
}

// Format "2025-01-15" → "Jan 15"
function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TimeSeriesChart({ data, platforms }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  function toggle(platform: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  if (platforms.length === 0 || data.every((d) => platforms.every((p) => !d[p]))) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        No scan data in the last 30 days.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Platform toggle buttons */}
      <div className="flex flex-wrap gap-2">
        {platforms.map((pl) => {
          const color = PLATFORM_COLORS[pl] ?? "#6366f1";
          const active = !hidden.has(pl);
          return (
            <button
              key={pl}
              onClick={() => toggle(pl)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                active
                  ? "border-transparent text-white"
                  : "border-slate-200 bg-white text-slate-400"
              }`}
              style={active ? { backgroundColor: color, borderColor: color } : {}}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: active ? "white" : color }}
              />
              {pl}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) => formatDate(String(label))}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [`${value}%`, name]}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ display: "none" }} />
          {platforms.map((pl) => (
            <Line
              key={pl}
              type="monotone"
              dataKey={pl}
              stroke={PLATFORM_COLORS[pl] ?? "#6366f1"}
              strokeWidth={2}
              dot={false}
              hide={hidden.has(pl)}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
