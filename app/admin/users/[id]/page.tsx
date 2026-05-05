"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, User, Shield, CreditCard, Globe, CheckCircle,
  XCircle, AlertTriangle, Loader2, ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-gray-700 text-gray-300",
  STARTER: "bg-blue-900 text-blue-300",
  GROWTH: "bg-purple-900 text-purple-300",
  ENTERPRISE: "bg-amber-900 text-amber-300",
};

export default function AdminUserProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [impersonateModal, setImpersonateModal] = useState(false);
  const [impersonateChecked, setImpersonateChecked] = useState(false);
  const [banModal, setBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [refundModal, setRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    await fetch(`/api/admin/users/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: note }),
    });
    setNote("");
    fetchData();
    setSavingNote(false);
  }

  async function startImpersonate() {
    const res = await fetch(`/api/admin/users/${id}/impersonate`, { method: "POST" });
    const json = await res.json();
    if (res.ok) router.push(json.redirectTo);
  }

  async function handleBan() {
    await fetch(`/api/admin/users/${id}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: banReason }),
    });
    setBanModal(false);
    fetchData();
  }

  async function handleRefund() {
    await fetch(`/api/admin/users/${id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(refundAmount), reason: "Admin refund" }),
    });
    setRefundModal(false);
    alert("Refund issued.");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center h-screen text-gray-400">User not found.</div>
  );

  const user = data.user as Record<string, unknown>;
  const projects = (data.projects as Record<string, unknown>[]) ?? [];
  const usage = data.usage as Record<string, unknown>;
  const subscriptionHistory = (data.subscriptionHistory as Record<string, unknown>[]) ?? [];
  const notes = (data.notes as Record<string, unknown>[]) ?? [];

  const initials = ((user.name as string) ?? (user.email as string))[0].toUpperCase();

  const usageChartData = [
    { name: "Mentions", count: (usage?.totalMentions as number) ?? 0 },
    { name: "Citations", count: (usage?.totalCitations as number) ?? 0 },
    { name: "Reports", count: (usage?.totalReports as number) ?? 0 },
  ];

  return (
    <div className="p-6 space-y-6 pb-20">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-400 hover:text-gray-200 text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to users
      </button>

      {/* Header card */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-900 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-indigo-300">{initials}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{(user.name as string) || "No name"}</h1>
              <p className="text-gray-400 text-sm">{user.email as string}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[user.plan as string] ?? PLAN_COLORS.FREE}`}>
                  {user.plan as string}
                </span>
                {(user.adminBanned as boolean) && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-900 text-red-300">BANNED</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-400">Joined {format(new Date(user.createdAt as string), "MMM d, yyyy")}</p>
            <p className="text-gray-400">Last active {formatDistanceToNow(new Date(user.updatedAt as string), { addSuffix: true })}</p>
            <p className="text-white font-bold text-lg mt-1">${(user.lifetimeRevenue as number).toFixed(2)} lifetime</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={() => setImpersonateModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <User className="w-3.5 h-3.5" /> Impersonate
          </button>
          <button className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Globe className="w-3.5 h-3.5" /> Email user
          </button>
          <button
            onClick={() => setBanModal(true)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-red-900 text-gray-200 hover:text-red-300 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Shield className="w-3.5 h-3.5" /> {(user.adminBanned as boolean) ? "Unban" : "Ban"}
          </button>
          <button
            onClick={() => setRefundModal(true)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" /> Issue refund
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Account details */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider mb-4">Account details</h2>
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id as string} className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-200">{p.brandName as string}</p>
                  <p className="text-xs text-gray-500">{p.websiteUrl as string}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>{p.prompts as number} prompts · {p.competitors as number} competitors</p>
                  <p>{p.mentions as number} mentions</p>
                </div>
              </div>
            ))}
            {projects.length === 0 && <p className="text-gray-500 text-sm">No projects yet.</p>}
            <div className="pt-3 border-t border-gray-700 flex items-center gap-3 text-sm">
              <span className="text-gray-400">GSC connected:</span>
              {(user.gscConnected as boolean) ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
            </div>
          </div>
        </div>

        {/* Usage stats */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider mb-4">Usage stats</h2>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={usageChartData} barSize={24}>
              <CartesianGrid vertical={false} stroke="#374151" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: 8, color: "#fff" }} />
              <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subscription history */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider mb-4">Subscription history</h2>
        {subscriptionHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">No subscription events.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
                <th className="text-left pb-2">Date</th>
                <th className="text-left pb-2">Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {subscriptionHistory.slice(0, 10).map((e, i) => (
                <tr key={i}>
                  <td className="py-2.5 text-gray-400">{format(new Date(e.createdAt as string), "MMM d, yyyy")}</td>
                  <td className="py-2.5 text-gray-300">{(e.type as string).replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Admin notes */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider mb-4">Admin notes</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a private note about this user…"
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-3"
        />
        <button
          onClick={saveNote}
          disabled={!note.trim() || savingNote}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          {savingNote ? "Saving…" : "Save note"}
        </button>

        {notes.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
            {notes.map((n, i) => {
              const admin = n.admin as Record<string, unknown>;
              return (
                <div key={i} className="bg-gray-900 rounded-xl p-3">
                  <p className="text-sm text-gray-200">{n.content as string}</p>
                  <p className="text-xs text-gray-500 mt-1.5">
                    {admin?.name as string ?? admin?.email as string} · {format(new Date(n.createdAt as string), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Impersonation modal */}
      {impersonateModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Start impersonation</h3>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              You are about to view BlockBoost as <strong className="text-white">{user.email as string}</strong>.
              All actions will be logged. Do not make changes without user consent.
            </p>
            <label className="flex items-center gap-2.5 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={impersonateChecked}
                onChange={(e) => setImpersonateChecked(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm text-gray-300">I understand and will not make changes without consent</span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => { setImpersonateModal(false); setImpersonateChecked(false); }}
                className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startImpersonate}
                disabled={!impersonateChecked}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                Start impersonation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban modal */}
      {banModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-4">Ban account</h3>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Reason for ban…"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 mb-4 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setBanModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-700 text-gray-200 text-sm font-semibold">Cancel</button>
              <button onClick={handleBan} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold">Ban account</button>
            </div>
          </div>
        </div>
      )}

      {/* Refund modal */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-4">Issue refund</h3>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="Amount in USD"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 mb-4 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex gap-3">
              <button onClick={() => setRefundModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-700 text-gray-200 text-sm font-semibold">Cancel</button>
              <button onClick={handleRefund} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">Issue refund</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
