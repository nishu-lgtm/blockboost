"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BRAND_COLORS } from "./sov-chart";
import type { TrendPoint } from "@/lib/competitor-types";

interface Props {
  data: TrendPoint[];
  brands: string[]; // [yourBrand, ...competitors]
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CompetitorTrendChart({ data, brands }: Props) {
  const hasData = data.some((d) => brands.some((b) => Number(d[b]) > 0));

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        No trend data in the last 30 days. Run scans to see competitor trends.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
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
          formatter={(value: any, name: any) => [
            `${value}%`,
            name === brands[0] ? `${name} (you)` : name,
          ]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
          }}
        />
        {brands.map((brand, i) => (
          <Line
            key={brand}
            type="monotone"
            dataKey={brand}
            stroke={BRAND_COLORS[i] ?? "#94a3b8"}
            strokeWidth={i === 0 ? 2.5 : 1.8}
            strokeDasharray={i === 0 ? undefined : "4 2"}
            dot={false}
            activeDot={{ r: 4 }}
            name={brand}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
