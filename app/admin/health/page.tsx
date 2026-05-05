"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle, XCircle, AlertTriangle, Play, RefreshCw, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface PlatformStat {
  platform: string;
  key: string;
  status: "healthy" | "degraded" | "unknown";
  lastSuccess: string | null;
  mentionsLast7d: number;
  successRate: number;
}

interface CronJob {
  name: string;
  cron: string;
  lastRun: string;
  duration: number;
  status: "success" | "failed" | "running";
  nextRun: string;
}

interface HealthData {
  dbStats: Record<string, number>;
  platformStats: PlatformStat[];
  cronHistory: CronJob[];
  scansByDay: { date: string; count: number }[];
  queueStats: { pending: number; processing: number; failedLastHour: number; avgScanTimeMinutes: number };
  apiUsage: {
    openai: { today: number; month: number; costEstimate: number };
    apify: { today: number; month: number };
    resend: { today: number; month: number };
  };
}

const STATUS_CONFIG = {
  healthy: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-900/40", label: "Healthy" },
  degraded: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-900/40", label: "Degraded" },
  unknown:  { icon: XCircle,       color: "text-gray-500",  bg: "bg-gray-700",     label: "No data" },
};

const CRON_STATUS_CONFIG = {
  success: { icon: CheckCircle, color: "text-green-400" },
  failed:  { icon: XCircle,     color: "text-red-400"   },
  running: { icon: RefreshCw,   color: "text-blue-400"  },
};

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/health");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function runCron(job: string) {
    setRunningJob(job);
    try {
      await fetch("/api/admin/health/run-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      await fetchData();
    } finally {
      setRunningJob(null);
    }
  }

  async function testScraper(platform: string) {
    setRunningTest(platform);
    try {
      const res = await fetch("/api/admin/health/test-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const result = await res.json();
      setTestResults((prev) => ({ ...prev, [platform]: { ok: res.ok, message: result.message ?? (res.ok ? "OK" : "Failed") } }));
    } finally {
      setRunningTest(null);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Platform Health</h1>
        <p className="text-gray-400 text-sm mt-0.5">Scrapers, cron jobs, queue, and API usage</p>
      </div>

      {/* Queue stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pending scans",    value: data.queueStats.pending,            suffix: "" },
          { label: "Processing",       value: data.queueStats.processing,         suffix: "" },
          { label: "Failed (1h)",      value: data.queueStats.failedLastHour,     suffix: "" },
          { label: "Avg scan time",    value: data.queueStats.avgScanTimeMinutes, suffix: " min" },
        ].map(({ label, value, suffix }) => (
          <div key={label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}{suffix}</p>
          </div>
        ))}
      </div>

      {/* Two-col: scrapers + scans chart */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Platform scraper table */}
        <div className="xl:col-span-3 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-700">
            <h2 className="text-sm font-bold text-white">Scraper status</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
                <th className="text-left px-5 py-3">Platform</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">7d mentions</th>
                <th className="text-right px-5 py-3">Success rate</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {data.platformStats.map((p) => {
                const cfg = STATUS_CONFIG[p.status];
                const Icon = cfg.icon;
                const testResult = testResults[p.key];
                return (
                  <tr key={p.key} className="hover:bg-gray-700/20">
                    <td className="px-5 py-3 font-medium text-gray-200">{p.platform}</td>
                    <td className="px-5 py-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </div>
                      {testResult && (
                        <span className={`ml-2 text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                          {testResult.message}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400">{p.mentionsLast7d}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-700 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-green-500"
                            style={{ width: `${p.successRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">{p.successRate}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => testScraper(p.key)}
                        disabled={runningTest === p.key}
                        className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                      >
                        {runningTest === p.key ? "Testing…" : "Test"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Scans per day chart */}
        <div className="xl:col-span-2 bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-sm font-bold text-white mb-4">Scans per day (7d)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.scansByDay} barSize={28}>
              <CartesianGrid vertical={false} stroke="#374151" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: 8, color: "#fff" }} />
              <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cron jobs */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-sm font-bold text-white">Cron jobs</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
              <th className="text-left px-5 py-3">Job</th>
              <th className="text-left px-5 py-3">Schedule</th>
              <th className="text-left px-5 py-3">Last run</th>
              <th className="text-left px-5 py-3">Duration</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">Next run</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {data.cronHistory.map((job) => {
              const cfg = CRON_STATUS_CONFIG[job.status];
              const Icon = cfg.icon;
              return (
                <tr key={job.name} className="hover:bg-gray-700/20">
                  <td className="px-5 py-3 font-mono text-gray-200 text-xs">{job.name}</td>
                  <td className="px-5 py-3 font-mono text-gray-500 text-xs">{job.cron}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{job.duration}s</td>
                  <td className="px-5 py-3">
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {job.status}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => runCron(job.name)}
                      disabled={runningJob === job.name}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                    >
                      {runningJob === job.name ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      {runningJob === job.name ? "Running…" : "Run now"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Two-col: DB stats + API usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DB stats */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-sm font-bold text-white mb-4">Database table counts</h2>
          <div className="space-y-2">
            {Object.entries(data.dbStats).map(([table, count]) => (
              <div key={table} className="flex items-center justify-between text-sm">
                <span className="text-gray-400 capitalize">{table}</span>
                <span className="font-mono text-gray-200">{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* API usage */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-sm font-bold text-white mb-4">API usage</h2>
          <div className="space-y-4">
            {[
              {
                name: "OpenAI",
                rows: [
                  { label: "Calls today",  value: data.apiUsage.openai.today },
                  { label: "Calls this month", value: data.apiUsage.openai.month },
                  { label: "Est. cost",    value: `$${data.apiUsage.openai.costEstimate.toFixed(2)}` },
                ],
              },
              {
                name: "Apify",
                rows: [
                  { label: "Runs today",   value: data.apiUsage.apify.today },
                  { label: "Runs this month", value: data.apiUsage.apify.month },
                ],
              },
              {
                name: "Resend",
                rows: [
                  { label: "Emails today",   value: data.apiUsage.resend.today },
                  { label: "Emails this month", value: data.apiUsage.resend.month },
                ],
              },
            ].map((api) => (
              <div key={api.name}>
                <p className="text-xs font-semibold text-gray-300 mb-1.5">{api.name}</p>
                <div className="space-y-1 pl-3 border-l border-gray-700">
                  {api.rows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{row.label}</span>
                      <span className="font-mono text-gray-300">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
