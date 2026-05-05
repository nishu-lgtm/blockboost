"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  adminUser: { name: string | null; email: string; adminRole: string };
}

interface AdminMember {
  id: string;
  name: string | null;
  email: string;
  adminRole: string;
}

interface AuditData {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
  admins: AdminMember[];
}

const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  BAN_USER:         { label: "Banned user",         color: "text-red-400",    icon: "🚫" },
  UNBAN_USER:       { label: "Unbanned user",        color: "text-green-400",  icon: "✅" },
  IMPERSONATE:      { label: "Impersonated",         color: "text-amber-400",  icon: "👤" },
  CHANGE_PLAN:      { label: "Changed plan",         color: "text-blue-400",   icon: "💳" },
  REFUND:           { label: "Issued refund",        color: "text-orange-400", icon: "↩️" },
  ADD_NOTE:         { label: "Added note",           color: "text-gray-300",   icon: "📝" },
  EXTEND_TRIAL:     { label: "Extended trial",       color: "text-purple-400", icon: "⏳" },
  INVITE_ADMIN:     { label: "Invited admin",        color: "text-indigo-400", icon: "🛡️" },
  REVOKE_ADMIN:     { label: "Revoked admin",        color: "text-red-400",    icon: "🚫" },
  UPDATE_ROLE:      { label: "Updated role",         color: "text-blue-400",   icon: "🔄" },
  SEND_EMAIL:       { label: "Sent email",           color: "text-slate-300",  icon: "📧" },
  CREATE_BANNER:    { label: "Created banner",       color: "text-cyan-400",   icon: "📢" },
  UPDATE_BANNER:    { label: "Updated banner",       color: "text-cyan-400",   icon: "📢" },
  RUN_CRON:         { label: "Ran cron job",         color: "text-green-400",  icon: "⚙️" },
  TEST_SCRAPER:     { label: "Tested scraper",       color: "text-blue-400",   icon: "🔍" },
  VIEW_USER:        { label: "Viewed user",          color: "text-gray-500",   icon: "👁️" },
};

const ROLE_COLORS: Record<string, string> = {
  VIEWER:     "bg-blue-900 text-blue-300",
  SUPPORT:    "bg-purple-900 text-purple-300",
  ADMIN:      "bg-red-900 text-red-300",
  SUPERADMIN: "bg-red-600 text-white",
};

export default function AdminAuditPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [adminId, setAdminId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (adminId) params.set("adminId", adminId);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/admin/audit?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [page, adminId, action, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function downloadCsv() {
    const params = new URLSearchParams();
    if (adminId) params.set("adminId", adminId);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("export", "csv");
    window.open(`/api/admin/audit?${params}`, "_blank");
  }

  const uniqueActions = Object.keys(ACTION_META).sort();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Audit log</h1>
          <p className="text-gray-400 text-sm mt-0.5">Every admin action, recorded</p>
        </div>
        <button
          onClick={downloadCsv}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium px-3 py-2 rounded-xl transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={adminId}
          onChange={(e) => { setAdminId(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All admins</option>
          {data?.admins.map((a) => (
            <option key={a.id} value={a.id}>{a.name ?? a.email}</option>
          ))}
        </select>

        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All actions</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>{ACTION_META[a]?.label ?? a}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-gray-500 text-sm">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {(adminId || action || from || to) && (
          <button
            onClick={() => { setAdminId(""); setAction(""); setFrom(""); setTo(""); setPage(1); }}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Log table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data || data.logs.length === 0 ? (
          <p className="text-center py-12 text-gray-500 text-sm">No audit logs found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
                <th className="text-left px-5 py-3">Action</th>
                <th className="text-left px-5 py-3">Admin</th>
                <th className="text-left px-5 py-3">Target</th>
                <th className="text-right px-5 py-3">IP</th>
                <th className="text-right px-5 py-3">Time</th>
                <th className="px-5 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {data.logs.map((log) => {
                const meta = ACTION_META[log.action] ?? { label: log.action, color: "text-gray-400", icon: "⚪" };
                const isExpanded = expanded === log.id;
                const hasDetails = log.details && Object.keys(log.details).length > 0;

                return (
                  <>
                    <tr
                      key={log.id}
                      className={`hover:bg-gray-700/20 transition-colors ${hasDetails ? "cursor-pointer" : ""}`}
                      onClick={() => hasDetails && toggleExpand(log.id)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{meta.icon}</span>
                          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div>
                          <p className="text-gray-200 text-xs">{log.adminUser.name ?? log.adminUser.email}</p>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[log.adminUser.adminRole] ?? "bg-gray-700 text-gray-400"}`}>
                            {log.adminUser.adminRole}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs font-mono">
                        {log.targetId ? (
                          <span title={log.targetId}>
                            {log.targetType ? `${log.targetType}: ` : ""}
                            {log.targetId.slice(0, 8)}…
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-500 text-xs font-mono">
                        {log.ipAddress ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                        {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {hasDetails && (
                          isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                            : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasDetails && (
                      <tr key={`${log.id}-details`} className="bg-gray-900/60">
                        <td colSpan={6} className="px-5 py-3">
                          <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap bg-gray-900 rounded-lg p-3 overflow-auto max-h-40">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            {((data.page - 1) * 50) + 1}–{Math.min(data.page * 50, data.total)} of {data.total.toLocaleString()} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {data.page} of {data.totalPages}</span>
            <button
              onClick={() => setPage(Math.min(data.totalPages, page + 1))}
              disabled={page === data.totalPages}
              className="p-2 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
