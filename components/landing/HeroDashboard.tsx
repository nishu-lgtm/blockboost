"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

const chartData = [
  { platform: "ChatGPT", rate: 62, fill: "#F59E0B" },
  { platform: "Perplexity", rate: 48, fill: "#FBBF24" },
  { platform: "Gemini", rate: 31, fill: "#FCD34D" },
  { platform: "Copilot", rate: 19, fill: "#FDE68A" },
];

export function HeroDashboard() {
  return (
    <div className="rounded-2xl border border-gray-200 shadow-2xl overflow-hidden bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">Block</span>
          <span className="text-sm font-bold text-amber-500">Boost</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-gray-500">Live</span>
          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-xs font-bold text-amber-700">JT</span>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <p className="text-xs text-amber-600 font-semibold mb-1">AI Mention Rate</p>
          <p className="text-2xl font-bold text-gray-900">34%</p>
          <p className="text-xs text-green-600 font-semibold mt-1">↑ +8pp this week</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-xs text-gray-500 font-semibold mb-1">Best Platform</p>
          <p className="text-sm font-bold text-gray-900">ChatGPT</p>
          <p className="text-xs text-gray-400 mt-1">62% mention rate</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-xs text-gray-500 font-semibold mb-1">Citations Found</p>
          <p className="text-2xl font-bold text-gray-900">12</p>
          <p className="text-xs text-green-600 font-semibold mt-1">+4 new</p>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Mention Rate by Platform
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} barSize={28}>
            <CartesianGrid vertical={false} stroke="#F3F4F6" />
            <XAxis
              dataKey="platform"
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, 80]} />
            <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
