"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Filter, Download, MoreHorizontal, ChevronLeft, ChevronRight,
  UserX, Mail, Shield, Zap, CreditCard, Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface UserRow {
  id: string; email: string; name: string | null; brandName: string;
  plan: string; createdAt: string; lastActive: string;
  mrr: number; projectCount: number; banned: boolean; hasStripe: boolean;
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-gray-700 text-gray-300",
  STARTER: "bg-blue-900 text-blue-300",
  GROWTH: "bg-purple-900 text-purple-300",
  ENTERPRISE: "bg-amber-900 text-amber-300",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ q, plan, status, sort, page: String(page) });
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [q, plan, status, sort, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleBan(id: string, banned: boolean) {
    await fetch(`/api/admin/users/${id}/${banned ? "unban" : "ban"}`, { method: "POST" });
    fetchUsers();
    setOpenMenu(null);
  }

  async function handleImpersonate(id: string) {
    const res = await fetch(`/api/admin/users/${id}/impersonate`, { method: "POST" });
    const data = await res.json();
    if (res.ok) router.push(data.redirectTo);
    setOpenMenu(null);
  }

  async function handleChangePlan(id: string, newPlan: string) {
    await fetch(`/api/admin/users/${id}/change-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: newPlan }),
    });
    fetchUsers();
    setOpenMenu(null);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total.toLocaleString()} total users</p>
        </div>
        <a
          href="/api/admin/users?export=csv"
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium px-3 py-2 rounded-xl transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search email, name, business…"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        {[
          { label: "Plan", value: plan, set: setPlan, opts: ["all","free","starter","growth","enterprise"] },
          { label: "Status", value: status, set: setStatus, opts: ["all","active","banned"] },
          { label: "Sort", value: sort, set: setSort, opts: ["newest","oldest","plan"] },
        ].map(({ label, value, set, opts }) => (
          <select
            key={label}
            value={value}
            onChange={(e) => { set(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {opts.map((o) => (
              <option key={o} value={o}>{label}: {o}</option>
            ))}
          </select>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Business</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">Signed up</th>
              <th className="text-left px-4 py-3">Last active</th>
              <th className="text-right px-4 py-3">MRR</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-500">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-500">No users found.</td></tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-700/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/admin/users/${u.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-900 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-indigo-300">
                          {(u.name ?? u.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-200 leading-tight">{u.name ?? "—"}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{u.brandName}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[u.plan] ?? PLAN_COLORS.FREE}`}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {format(new Date(u.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {formatDistanceToNow(new Date(u.lastActive), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    {u.mrr > 0 ? `$${u.mrr}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.banned ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"}`}>
                      {u.banned ? "Banned" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-600 text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openMenu === u.id && (
                        <div className="absolute right-0 top-8 z-10 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-1">
                          <button onClick={() => router.push(`/admin/users/${u.id}`)} className="menu-item">View profile</button>
                          <button onClick={() => handleImpersonate(u.id)} className="menu-item">Impersonate</button>
                          <button className="menu-item">Send email</button>
                          <div className="border-t border-gray-700 my-1" />
                          {["FREE","STARTER","GROWTH","ENTERPRISE"].filter(p => p !== u.plan).map(p => (
                            <button key={p} onClick={() => handleChangePlan(u.id, p)} className="menu-item">
                              Change to {p}
                            </button>
                          ))}
                          <div className="border-t border-gray-700 my-1" />
                          <button onClick={() => handleBan(u.id, u.banned)} className="menu-item text-red-400">
                            {u.banned ? "Unban account" : "Ban account"}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>Showing {users.length} of {total} users</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style jsx>{`
        .menu-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 8px 16px;
          font-size: 13px;
          color: #D1D5DB;
          transition: background 0.15s;
        }
        .menu-item:hover { background: #374151; color: #fff; }
      `}</style>
    </div>
  );
}
