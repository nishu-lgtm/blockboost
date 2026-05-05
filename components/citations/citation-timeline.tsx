"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TimelinePoint } from "@/lib/citation-types";

interface Props {
  data: TimelinePoint[];
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CitationTimeline({ data }: Props) {
  const hasData = data.some((d) => d.owned > 0 || d.thirdParty > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        No citation data in this period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ownedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="thirdGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0891b2" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#0891b2" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => formatDate(String(label))}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          formatter={(value) =>
            value === "owned" ? "Your pages" : "Third-party sources"
          }
        />
        <Area
          type="monotone"
          dataKey="owned"
          stroke="#4f46e5"
          strokeWidth={2}
          fill="url(#ownedGrad)"
          dot={false}
          activeDot={{ r: 4 }}
          name="owned"
        />
        <Area
          type="monotone"
          dataKey="thirdParty"
          stroke="#0891b2"
          strokeWidth={2}
          fill="url(#thirdGrad)"
          dot={false}
          activeDot={{ r: 4 }}
          name="thirdParty"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
