"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, UserMinus, ChevronDown, Plus, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AdminMember {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  adminRole: string;
  totpEnabled: boolean;
  updatedAt: string;
}

const ROLES = ["VIEWER", "SUPPORT", "ADMIN", "SUPERADMIN"] as const;
type Role = typeof ROLES[number];

const ROLE_COLORS: Record<Role, string> = {
  VIEWER:     "bg-blue-900 text-blue-300",
  SUPPORT:    "bg-purple-900 text-purple-300",
  ADMIN:      "bg-red-900 text-red-300",
  SUPERADMIN: "bg-red-600 text-white",
};

const ROLE_PERMS: Record<Role, string[]> = {
  VIEWER:     ["View dashboard", "View users", "View revenue", "View health", "View audit log"],
  SUPPORT:    ["Everything in Viewer", "Send emails", "Manage banners", "Add notes to users"],
  ADMIN:      ["Everything in Support", "Ban/unban users", "Change plans", "Impersonate users", "Invite admins", "Revoke admin access"],
  SUPERADMIN: ["Everything in Admin", "Grant SUPERADMIN role", "Full unrestricted access"],
};

export default function AdminTeamPage() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("SUPPORT");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [roleMenuId, setRoleMenuId] = useState<string | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    const res = await fetch("/api/admin/team");
    if (res.ok) {
      const d = await res.json();
      setMembers(d.admins ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function handleInvite() {
    setInviting(true);
    setInviteResult(null);
    const res = await fetch("/api/admin/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const d = await res.json();
    setInviteResult({ ok: res.ok, message: d.message ?? (res.ok ? "Admin added successfully." : d.error ?? "Failed.") });
    setInviting(false);
    if (res.ok) {
      setInviteEmail("");
      setShowInvite(false);
      fetchMembers();
    }
  }

  async function changeRole(id: string, role: string) {
    await fetch(`/api/admin/team/${id}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setRoleMenuId(null);
    fetchMembers();
  }

  async function revokeAccess(id: string) {
    await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
    setRevokeConfirm(null);
    fetchMembers();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Team</h1>
          <p className="text-gray-400 text-sm mt-0.5">Admin access and role management</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add admin
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-gray-800 rounded-xl border border-indigo-700 p-5 space-y-4 max-w-lg">
          <h2 className="text-sm font-bold text-white">Add admin</h2>
          <p className="text-xs text-gray-400">
            The user must already have a BlockBoost account. They will receive an email and need to set up 2FA on their first admin visit.
          </p>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Email address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-colors ${
                    inviteRole === r ? "border-indigo-500 bg-indigo-950" : "border-gray-600 hover:border-gray-500"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${inviteRole === r ? "border-indigo-500 bg-indigo-500" : "border-gray-500"}`} />
                  <span className={`font-medium ${inviteRole === r ? "text-indigo-300" : "text-gray-300"}`}>{r}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Permission preview */}
          <div className="bg-gray-700 rounded-xl p-3">
            <p className="text-xs font-medium text-gray-300 mb-2">{inviteRole} permissions</p>
            <ul className="space-y-1">
              {ROLE_PERMS[inviteRole].map((p) => (
                <li key={p} className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {inviteResult && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${inviteResult.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}>
              {inviteResult.message}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setShowInvite(false)} className="text-sm text-gray-400 hover:text-gray-200">Cancel</button>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              {inviting ? "Adding…" : "Add admin"}
            </button>
          </div>
        </div>
      )}

      {/* Team table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <p className="text-gray-500 text-sm p-5">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
                <th className="text-left px-5 py-3">Member</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">2FA</th>
                <th className="text-left px-5 py-3">Last updated</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-700/20">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {m.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.image} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center">
                          <span className="text-xs font-bold text-indigo-300">
                            {(m.name ?? m.email)[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-200">{m.name ?? "—"}</p>
                        <p className="text-xs text-gray-500">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setRoleMenuId(roleMenuId === m.id ? null : m.id)}
                        className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full ${ROLE_COLORS[m.adminRole as Role] ?? ROLE_COLORS.VIEWER}`}
                      >
                        {m.adminRole}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {roleMenuId === m.id && (
                        <div className="absolute left-0 top-8 z-10 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-1 min-w-32">
                          {ROLES.map((r) => (
                            <button
                              key={r}
                              onClick={() => changeRole(m.id, r)}
                              className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                                r === m.adminRole ? "text-indigo-300 bg-indigo-950" : "text-gray-300 hover:bg-gray-700"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${m.totpEnabled ? "text-green-400" : "text-red-400"}`}>
                      {m.totpEnabled ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {m.totpEnabled ? "Enabled" : "Not set up"}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {formatDistanceToNow(new Date(m.updatedAt), { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {revokeConfirm === m.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-400">Revoke access?</span>
                        <button onClick={() => revokeAccess(m.id)} className="text-xs text-red-400 hover:text-red-300 font-medium">Yes</button>
                        <button onClick={() => setRevokeConfirm(null)} className="text-xs text-gray-500 hover:text-gray-300">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRevokeConfirm(m.id)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Permissions matrix */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <h2 className="text-sm font-bold text-white mb-4">Role permissions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {ROLES.map((role) => (
            <div key={role} className="space-y-2">
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLORS[role]}`}>
                <Shield className="w-3 h-3" />
                {role}
              </div>
              <ul className="space-y-1.5">
                {ROLE_PERMS[role].map((p) => (
                  <li key={p} className="flex items-start gap-2 text-xs text-gray-400">
                    <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
