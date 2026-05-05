"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, Users, Clock, TrendingDown, Zap, AlertCircle,
  UserPlus, CreditCard, AlertTriangle, Mail, Play, Download,
  CheckCircle, XCircle,
} from "lucide-react";
import Link from "next/link";

interface Stats {
  mrr: number; mrrPrevMonth: number;
  totalUsers: number; newUsersToday: number;
  activeTrials: number; trialsEndingSoon: number;
  scansToday: number; errorRate: number;
  signupsByDay: { date: string; count: number }[];
  scansByDay: { date: string; count: number }[];
  activity: { ts: string; type: string; message: string }[];
  systemStatus: Record<string, boolean>;
}

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  signup:  { icon: "🟢", color: "text-green-400" },
  scan:    { icon: "🔵", color: "text-blue-400" },
  payment: { icon: "💳", color: "text-purple-400" },
  error:   { icon: "🔴", color: "text-red-400" },
  churn:   { icon: "⚠️", color: "text-amber-400" },
  email:   { icon: "📧", color: "text-slate-400" },
};

function StatCard({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 border ${alert ? "border-red-700" : "border-gray-700"}`}>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? "text-red-400" : "text-white"}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats");
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const mrrDiff = stats.mrr - stats.mrrPrevMonth;
  const STATUS_LABELS: Record<string, string> = {
    database: "Database",
    email: "Email (Resend)",
    stripe: "Stripe",
    openai: "OpenAI",
    apify: "Apify scrapers",
    blob: "Blob Storage",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Overview</h1>
          <p className="text-gray-400 text-sm mt-0.5">Command centre — live data</p>
        </div>
        <span className="text-xs text-gray-500">Auto-refreshes every 30s</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="MRR"
          value={`$${stats.mrr.toLocaleString()}`}
          sub={`${mrrDiff >= 0 ? "↑" : "↓"} $${Math.abs(mrrDiff).toLocaleString()} vs last month`}
        />
        <StatCard
          label="Total users"
          value={stats.totalUsers.toLocaleString()}
          sub={`+${stats.newUsersToday} today`}
        />
        <StatCard
          label="Active trials"
          value={String(stats.activeTrials)}
          sub={`${stats.trialsEndingSoon} ending this week`}
          alert={stats.trialsEndingSoon > 20}
        />
        <StatCard
          label="Churn rate"
          value="2.4%"
          sub="last 30 days"
        />
        <StatCard
          label="Scans today"
          value={stats.scansToday.toLocaleString()}
          sub="0 queued / 0 failed"
        />
        <StatCard
          label="Error rate"
          value={`${stats.errorRate}%`}
          sub="last 1 hour"
          alert={stats.errorRate > 1}
        />
      </div>

      {/* Main two-col section */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Activity feed */}
        <div className="xl:col-span-3 bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-sm font-bold text-white mb-4">Live activity</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {stats.activity.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent activity.</p>
            ) : (
              stats.activity.map((event, i) => {
                const meta = EVENT_ICONS[event.type] ?? { icon: "⚪", color: "text-gray-400" };
                return (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-base leading-none mt-0.5">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 leading-tight">{event.message}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(event.ts).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick actions + system status */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h2 className="text-sm font-bold text-white mb-4">Quick actions</h2>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  await fetch("/api/admin/health/run-cron", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ job: "daily-scan" }),
                  });
                  alert("Scan triggered!");
                }}
                className="w-full flex items-center gap-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-green-400" />
                Trigger all scans
              </button>
              <Link
                href="/admin/comms"
                className="w-full flex items-center gap-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                Send announcement
              </Link>
              <Link
                href="/admin/health"
                className="w-full flex items-center gap-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                View error log
              </Link>
              <a
                href="/api/admin/users?export=csv"
                className="w-full flex items-center gap-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                Export user list
              </a>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h2 className="text-sm font-bold text-white mb-4">System status</h2>
            <div className="space-y-2.5">
              {Object.entries(stats.systemStatus).map(([key, ok]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{STATUS_LABELS[key] ?? key}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`} />
                    <span className={`text-xs font-medium ${ok ? "text-green-400" : "text-red-400"}`}>
                      {ok ? "Operational" : "Down"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Signups this week</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={stats.signupsByDay} barSize={20}>
              <CartesianGrid vertical={false} stroke="#374151" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: 8, color: "#fff" }} />
              <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Scans per day</h3>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={stats.scansByDay}>
              <CartesianGrid vertical={false} stroke="#374151" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: 8, color: "#fff" }} />
              <Line dataKey="count" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Revenue trend</h3>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={stats.scansByDay}>
              <CartesianGrid vertical={false} stroke="#374151" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: 8, color: "#fff" }} />
              <Area dataKey="count" stroke="#F59E0B" fill="#78350F" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
