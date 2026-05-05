"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { SoVPlatformBar } from "@/lib/competitor-types";

// Consistent brand color palette — index 0 = your brand (indigo), rest are competitors
export const BRAND_COLORS = [
  "#4f46e5", // indigo-600  — your brand
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
];

export const OTHER_COLOR = "#e2e8f0"; // slate-200

interface Props {
  data: SoVPlatformBar[];
  brands: string[]; // [yourBrand, ...competitors]
}

export function SoVChart({ data, brands }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        No scan data yet — run a scan to see share of voice.
      </div>
    );
  }

  const allKeys = [...brands, "Other"];

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 52)}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
          stackOffset="expand"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            domain={[0, 1]}
          />
          <YAxis
            type="category"
            dataKey="platform"
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              `${Math.round(value * 100)}%`,
              name,
            ]}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
          />
          {allKeys.map((brand, i) => (
            <Bar
              key={brand}
              dataKey={brand}
              stackId="sov"
              fill={i < brands.length ? BRAND_COLORS[i] ?? "#94a3b8" : OTHER_COLOR}
              name={brand}
              radius={i === 0 ? [4, 0, 0, 4] : i === allKeys.length - 1 ? [0, 4, 4, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Brand color legend pills */}
      <div className="flex flex-wrap gap-2 pt-1">
        {brands.map((brand, i) => (
          <div key={brand} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: BRAND_COLORS[i] ?? "#94a3b8" }}
            />
            {i === 0 ? <strong>{brand} (you)</strong> : brand}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-200" />
          Other / Not mentioned
        </div>
      </div>
    </div>
  );
}
