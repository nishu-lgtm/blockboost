"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, CreditCard, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface CancellationAnalytics {
  totalCancellations: number;
  totalSaved: number;
  saveRate: number;
  cancellationReasons: { reason: string; count: number }[];
  saveRates: { offer: string; shown: number; accepted: number; rate: number }[];
  featureRequests: { text: string; createdAt: string }[];
  topCompetitors: { name: string; count: number }[];
}

interface RevenueData {
  mrr: number;
  arr: number;
  newMrrThisMonth: number;
  churnedMrrThisMonth: number;
  netNewMrr: number;
  planDistribution: { plan: string; count: number; mrr: number }[];
  mrrByMonth: { month: string; mrr: number }[];
  recentEvents: {
    id: string;
    type: string;
    amount: number | null;
    createdAt: string;
    user: { email: string; plan: string };
  }[];
  cancellationAnalytics: CancellationAnalytics;
}

const REASON_LABELS: Record<string, string> = {
  too_expensive:     "💸 Too expensive",
  missing_feature:   "🔧 Missing feature",
  not_enough_value:  "📉 Not enough value",
  found_alternative: "🏆 Found alternative",
  taking_a_break:    "⏸️ Taking a break",
  closing_business:  "🏢 Closing business",
  too_complicated:   "😕 Too complicated",
  other:             "💬 Other",
};

const OFFER_LABELS: Record<string, string> = {
  discount:         "50% off 2 months",
  feature_request:  "1 month free + feedback",
  onboarding_call:  "Free onboarding call",
  competitor_intel: "Competitor intel",
  pause:            "Account pause",
  export_data:      "Export data",
  simple:           "Simple (no offer)",
};

const CANCEL_PIE_COLORS = ["#F59E0B", "#6366F1", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#6B7280"];

const PLAN_COLORS: Record<string, string> = {
  FREE: "#6B7280",
  STARTER: "#3B82F6",
  GROWTH: "#8B5CF6",
  ENTERPRISE: "#F59E0B",
};

const PIE_COLORS = ["#6B7280", "#3B82F6", "#8B5CF6", "#F59E0B"];

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  SUBSCRIBED:   { label: "New subscription",  color: "text-green-400" },
  UPGRADED:     { label: "Upgraded",          color: "text-blue-400"  },
  DOWNGRADED:   { label: "Downgraded",        color: "text-amber-400" },
  CANCELLED:    { label: "Cancelled",         color: "text-red-400"   },
  REFUNDED:     { label: "Refunded",          color: "text-orange-400"},
  PAYMENT_FAILED: { label: "Payment failed",  color: "text-red-500"   },
};

function MetricCard({
  label, value, sub, positive, icon: Icon,
}: {
  label: string; value: string; sub: string; positive?: boolean; icon: React.ElementType;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className={`text-xs mt-1 ${positive === undefined ? "text-gray-500" : positive ? "text-green-400" : "text-red-400"}`}>
            {sub}
          </p>
        </div>
        <div className="p-2 bg-gray-700 rounded-lg">
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/revenue");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalPlanCount = data.planDistribution.reduce((s, p) => s + p.count, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Revenue</h1>
        <p className="text-gray-400 text-sm mt-0.5">MRR, plan distribution, and subscription events</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <MetricCard label="MRR" value={`$${data.mrr.toLocaleString()}`} sub="Monthly recurring revenue" icon={DollarSign} />
        <MetricCard label="ARR" value={`$${data.arr.toLocaleString()}`} sub="Annual recurring revenue" icon={TrendingUp} />
        <MetricCard label="New MRR" value={`+$${data.newMrrThisMonth.toLocaleString()}`} sub="This month" positive icon={TrendingUp} />
        <MetricCard label="Churned MRR" value={`-$${data.churnedMrrThisMonth.toLocaleString()}`} sub="This month" positive={false} icon={TrendingDown} />
        <MetricCard label="Net New MRR" value={`$${data.netNewMrr.toLocaleString()}`} sub="This month" positive={data.netNewMrr >= 0} icon={CreditCard} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* MRR trend (12 months) */}
        <div className="xl:col-span-2 bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-sm font-bold text-white mb-4">MRR trend (12 months)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.mrrByMonth}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#374151" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: 8, color: "#fff" }}
                formatter={(v) => [`$${Number(v).toLocaleString()}`, "MRR"]}
              />
              <Area dataKey="mrr" stroke="#6366F1" fill="url(#mrrGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Plan distribution donut */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-sm font-bold text-white mb-4">Plan distribution</h2>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={data.planDistribution}
                dataKey="count"
                nameKey="plan"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                strokeWidth={0}
              >
                {data.planDistribution.map((entry, i) => (
                  <Cell key={entry.plan} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: 8, color: "#fff" }}
                formatter={(v, _name, props) => [
                  `${v} users · $${((props.payload as { mrr?: number })?.mrr ?? 0).toLocaleString()}/mo`,
                  (props.payload as { plan?: string })?.plan ?? "",
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {data.planDistribution.map((p, i) => (
              <div key={p.plan} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-gray-300">{p.plan}</span>
                </div>
                <span className="text-gray-500">
                  {p.count} ({totalPlanCount > 0 ? Math.round((p.count / totalPlanCount) * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MRR by plan bar chart */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <h2 className="text-sm font-bold text-white mb-4">MRR by plan</h2>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data.planDistribution} layout="vertical" barSize={18}>
            <CartesianGrid horizontal={false} stroke="#374151" />
            <XAxis type="number" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toLocaleString()}`} />
            <YAxis type="category" dataKey="plan" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={70} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: 8, color: "#fff" }}
              formatter={(v) => [`$${Number(v).toLocaleString()}/mo`, "MRR"]}
            />
            <Bar dataKey="mrr" radius={[0, 4, 4, 0]}>
              {data.planDistribution.map((entry, i) => (
                <Cell key={entry.plan} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent subscription events */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-sm font-bold text-white">Recent subscription events</h2>
        </div>
        {data.recentEvents.length === 0 ? (
          <p className="text-gray-500 text-sm p-5">No subscription events yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
                <th className="text-left px-5 py-3">Event</th>
                <th className="text-left px-5 py-3">User</th>
                <th className="text-left px-5 py-3">Plan</th>
                <th className="text-right px-5 py-3">Amount</th>
                <th className="text-right px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {data.recentEvents.map((ev) => {
                const meta = EVENT_LABELS[ev.type] ?? { label: ev.type, color: "text-gray-400" };
                return (
                  <tr key={ev.id} className="hover:bg-gray-700/20">
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-300 text-xs">{ev.user.email}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-400">{ev.user.plan}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-300 text-xs">
                      {ev.amount != null ? `$${ev.amount}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500 text-xs">
                      {format(new Date(ev.createdAt), "MMM d, HH:mm")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Cancellation Analytics ─────────────────────────────── */}
      {data.cancellationAnalytics && (
        <>
          <div className="border-t border-gray-700 pt-6">
            <h2 className="text-base font-bold text-white mb-1">Cancellation analytics</h2>
            <p className="text-gray-400 text-sm">Powered by the in-app cancellation flow</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total cancellations</p>
              <p className="text-2xl font-bold text-white">{data.cancellationAnalytics.totalCancellations}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Users saved</p>
              <p className="text-2xl font-bold text-green-400">{data.cancellationAnalytics.totalSaved}</p>
            </div>
            <div className={`rounded-xl p-4 border ${data.cancellationAnalytics.saveRate >= 15 ? "bg-green-900/30 border-green-700" : "bg-gray-800 border-gray-700"}`}>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Save rate</p>
              <p className={`text-2xl font-bold ${data.cancellationAnalytics.saveRate >= 15 ? "text-green-400" : "text-white"}`}>
                {data.cancellationAnalytics.saveRate}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Target: 15–25%</p>
            </div>
          </div>

          {/* Reason breakdown + save rates */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="text-sm font-bold text-white mb-4">Cancellation reasons</h3>
              {data.cancellationAnalytics.cancellationReasons.length === 0 ? (
                <p className="text-gray-500 text-sm">No data yet.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={data.cancellationAnalytics.cancellationReasons}
                        dataKey="count"
                        nameKey="reason"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        strokeWidth={0}
                      >
                        {data.cancellationAnalytics.cancellationReasons.map((_, i) => (
                          <Cell key={i} fill={CANCEL_PIE_COLORS[i % CANCEL_PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: 8, color: "#fff" }}
                        formatter={(v, _n, p) => [v, REASON_LABELS[(p.payload as { reason?: string })?.reason ?? ""] ?? ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {data.cancellationAnalytics.cancellationReasons.map((r, i) => (
                      <div key={r.reason} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CANCEL_PIE_COLORS[i % CANCEL_PIE_COLORS.length] }} />
                          <span className="text-gray-300">{REASON_LABELS[r.reason] ?? r.reason}</span>
                        </div>
                        <span className="text-gray-500 font-mono">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="text-sm font-bold text-white mb-4">Save rate per offer</h3>
              {data.cancellationAnalytics.saveRates.length === 0 ? (
                <p className="text-gray-500 text-sm">No data yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.cancellationAnalytics.saveRates.map((s) => (
                    <div key={s.offer}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-300">{OFFER_LABELS[s.offer] ?? s.offer}</span>
                        <span className="font-mono text-gray-400">{s.accepted}/{s.shown} · {s.rate}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${s.rate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Feature requests + competitors */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="text-sm font-bold text-white mb-4">Feature requests from cancellers</h3>
              {data.cancellationAnalytics.featureRequests.length === 0 ? (
                <p className="text-gray-500 text-sm">No feature requests yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {data.cancellationAnalytics.featureRequests.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-amber-400 flex-shrink-0 mt-0.5">→</span>
                      <span className="text-gray-300 leading-relaxed">{f.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="text-sm font-bold text-white mb-4">Competitors named</h3>
              {data.cancellationAnalytics.topCompetitors.length === 0 ? (
                <p className="text-gray-500 text-sm">No competitor data yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.cancellationAnalytics.topCompetitors.map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{c.name}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-700 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-indigo-400"
                            style={{ width: `${Math.min(100, (c.count / (data.cancellationAnalytics.topCompetitors[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-500 font-mono text-xs w-4 text-right">{c.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
