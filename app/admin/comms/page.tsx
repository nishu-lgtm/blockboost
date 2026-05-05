"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, Mail, Bell, ChevronRight, ChevronLeft, Eye, X, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

/* ── Types ─────────────────────────────────────────────── */
interface AdminEmail {
  id: string;
  subject: string;
  audience: string;
  recipientCount: number;
  sentAt: string;
  sentBy: { name: string | null; email: string };
}

interface Banner {
  id: string;
  message: string;
  type: string;
  audience: string;
  active: boolean;
  dismissable: boolean;
  ctaText: string | null;
  ctaUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

/* ── Email composer (3-step) ───────────────────────────── */
const AUDIENCES = [
  { value: "everyone",       label: "Everyone",                  desc: "All non-banned users" },
  { value: "paid",           label: "Paid users",                desc: "All non-free plan users" },
  { value: "plan",           label: "Specific plans",            desc: "Choose plans below" },
  { value: "trial",          label: "Active trials",             desc: "Signed up in last 14 days" },
  { value: "trial_expiring", label: "Trials expiring this week", desc: "Likely to churn soon" },
  { value: "churned",        label: "Recently churned",          desc: "Cancelled in last 30 days" },
];

const PLAN_OPTIONS = ["FREE", "STARTER", "GROWTH", "ENTERPRISE"];

const TEMPLATES = [
  {
    name: "Feature announcement",
    subject: "Introducing: [Feature Name] 🎉",
    html: `<p>Hi {{name}},</p>
<p>We're excited to announce a powerful new feature: <strong>[Feature Name]</strong>.</p>
<p>[Brief description of what it does and why it matters.]</p>
<p><a href="{{appUrl}}/dashboard">See it in action →</a></p>
<p>As always, let us know if you have questions.</p>
<p>— The BlockBoost team</p>`,
  },
  {
    name: "Trial ending reminder",
    subject: "Your free trial ends in 3 days",
    html: `<p>Hi {{name}},</p>
<p>Your BlockBoost trial ends in <strong>3 days</strong>. Don't lose your data — upgrade now to keep everything.</p>
<p><a href="{{appUrl}}/pricing">Upgrade your account →</a></p>
<p>Questions? Just reply to this email.</p>
<p>— The BlockBoost team</p>`,
  },
  {
    name: "Win-back",
    subject: "We miss you — here's what's new",
    html: `<p>Hi {{name}},</p>
<p>It's been a while since you used BlockBoost. Here's what we've shipped since you left:</p>
<ul>
  <li>[Feature 1]</li>
  <li>[Feature 2]</li>
  <li>[Feature 3]</li>
</ul>
<p><a href="{{appUrl}}/dashboard">Come back and explore →</a></p>
<p>— The BlockBoost team</p>`,
  },
];

type Step = 1 | 2 | 3;

export default function AdminCommsPage() {
  const [tab, setTab] = useState<"compose" | "history" | "banners">("compose");

  /* Composer state */
  const [step, setStep] = useState<Step>(1);
  const [audience, setAudience] = useState("everyone");
  const [planFilter, setPlanFilter] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("BlockBoost");
  const [fromEmail, setFromEmail] = useState("noreply@blockboost.co");
  const [htmlBody, setHtmlBody] = useState("");
  const [testOnly, setTestOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  /* History */
  const [emails, setEmails] = useState<AdminEmail[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);

  /* Banners */
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannerForm, setBannerForm] = useState<Partial<Banner> | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);

  const fetchEmails = useCallback(async () => {
    setEmailsLoading(true);
    const res = await fetch("/api/admin/comms/send-email");
    if (res.ok) {
      const d = await res.json();
      setEmails(d.emails ?? []);
    }
    setEmailsLoading(false);
  }, []);

  const fetchBanners = useCallback(async () => {
    setBannersLoading(true);
    const res = await fetch("/api/admin/comms/banner");
    if (res.ok) {
      const d = await res.json();
      setBanners(d.banners ?? []);
    }
    setBannersLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "history") fetchEmails();
    if (tab === "banners") fetchBanners();
  }, [tab, fetchEmails, fetchBanners]);

  function applyTemplate(t: typeof TEMPLATES[0]) {
    setSubject(t.subject);
    setHtmlBody(t.html);
    setStep(2);
  }

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/admin/comms/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, planFilter, subject, fromName, fromEmail, htmlBody, testOnly }),
    });
    const data = await res.json();
    setSendResult({ ok: res.ok, message: data.message ?? (res.ok ? "Sent!" : "Failed to send.") });
    setSending(false);
    if (res.ok && !testOnly) {
      setStep(1);
      setSubject("");
      setHtmlBody("");
    }
  }

  async function saveBanner() {
    if (!bannerForm) return;
    setSavingBanner(true);
    await fetch("/api/admin/comms/banner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bannerForm),
    });
    setBannerForm(null);
    fetchBanners();
    setSavingBanner(false);
  }

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Communications</h1>
        <p className="text-gray-400 text-sm mt-0.5">Email campaigns and in-app banners</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(["compose", "history", "banners"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? "border-indigo-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Compose tab ─────────────────────────────────── */}
      {tab === "compose" && (
        <div className="max-w-3xl space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-3">
            {[
              { n: 1, label: "Audience" },
              { n: 2, label: "Compose" },
              { n: 3, label: "Review & Send" },
            ].map(({ n, label }, i, arr) => (
              <div key={n} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step >= n ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-400"
                  }`}>{n}</div>
                  <span className={`text-sm ${step >= n ? "text-white" : "text-gray-500"}`}>{label}</span>
                </div>
                {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-gray-600" />}
              </div>
            ))}
          </div>

          {/* Step 1: Audience */}
          {step === 1 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
              <h2 className="text-sm font-bold text-white">Choose audience</h2>
              <div className="space-y-2">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setAudience(a.value)}
                    className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      audience === a.value
                        ? "border-indigo-500 bg-indigo-950"
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 ${
                      audience === a.value ? "border-indigo-500 bg-indigo-500" : "border-gray-500"
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-200">{a.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {audience === "plan" && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {PLAN_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() =>
                        setPlanFilter((prev) =>
                          prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                        )
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        planFilter.includes(p)
                          ? "border-indigo-500 bg-indigo-950 text-indigo-300"
                          : "border-gray-600 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Templates */}
              <div>
                <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Or start from a template</p>
                <div className="space-y-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => applyTemplate(t)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-left transition-colors"
                    >
                      <span className="text-sm text-gray-200">{t.name}</span>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Compose */}
          {step === 2 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
              <h2 className="text-sm font-bold text-white">Compose email</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From name</label>
                  <input
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From email</label>
                  <input
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Subject line</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Your email subject…"
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">HTML body</label>
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    {previewMode ? "Edit" : "Preview"}
                  </button>
                </div>
                {previewMode ? (
                  <div
                    className="bg-white rounded-xl p-4 text-gray-900 text-sm min-h-48 overflow-auto"
                    dangerouslySetInnerHTML={{ __html: htmlBody }}
                  />
                ) : (
                  <textarea
                    value={htmlBody}
                    onChange={(e) => setHtmlBody(e.target.value)}
                    rows={12}
                    placeholder="<p>Hi {{name}},</p>\n<p>Your email body here…</p>"
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                )}
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  disabled={!subject || !htmlBody}
                  onClick={() => setStep(3)}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
                >
                  Review →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Send */}
          {step === 3 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-5">
              <h2 className="text-sm font-bold text-white">Review & send</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Audience</span>
                  <span className="text-gray-200 font-medium capitalize">{audience}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">From</span>
                  <span className="text-gray-200">{fromName} &lt;{fromEmail}&gt;</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Subject</span>
                  <span className="text-gray-200">{subject}</span>
                </div>
              </div>
              <div className="bg-gray-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-2">Preview</p>
                <div
                  className="bg-white rounded-lg p-3 text-gray-900 text-sm overflow-auto max-h-48"
                  dangerouslySetInnerHTML={{ __html: htmlBody }}
                />
              </div>

              {/* Test send toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setTestOnly(!testOnly)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${testOnly ? "bg-indigo-600" : "bg-gray-600"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${testOnly ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-gray-300">Send test to my email first</span>
              </label>

              {sendResult && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium ${sendResult.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}>
                  {sendResult.message}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {sending ? "Sending…" : testOnly ? "Send test" : "Send email"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── History tab ────────────────────────────────── */}
      {tab === "history" && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {emailsLoading ? (
            <p className="text-gray-500 text-sm p-5">Loading…</p>
          ) : emails.length === 0 ? (
            <p className="text-gray-500 text-sm p-5">No emails sent yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
                  <th className="text-left px-5 py-3">Subject</th>
                  <th className="text-left px-5 py-3">Audience</th>
                  <th className="text-right px-5 py-3">Recipients</th>
                  <th className="text-left px-5 py-3">Sent by</th>
                  <th className="text-right px-5 py-3">Sent at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {emails.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-700/20">
                    <td className="px-5 py-3 text-gray-200">{e.subject}</td>
                    <td className="px-5 py-3 text-gray-400 capitalize">{e.audience}</td>
                    <td className="px-5 py-3 text-right text-gray-300 font-mono">{e.recipientCount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{e.sentBy.name ?? e.sentBy.email}</td>
                    <td className="px-5 py-3 text-right text-gray-500 text-xs">
                      {format(new Date(e.sentAt), "MMM d, yyyy HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Banners tab ─────────────────────────────────── */}
      {tab === "banners" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() =>
                setBannerForm({
                  message: "", type: "info", audience: "all",
                  dismissable: true, active: true,
                })
              }
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              New banner
            </button>
          </div>

          {/* Banner form */}
          {bannerForm && (
            <div className="bg-gray-800 rounded-xl border border-indigo-700 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">{bannerForm.id ? "Edit banner" : "New banner"}</h3>
                <button onClick={() => setBannerForm(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Message</label>
                <input
                  value={bannerForm.message ?? ""}
                  onChange={(e) => setBannerForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Your announcement…"
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Type</label>
                  <select
                    value={bannerForm.type ?? "info"}
                    onChange={(e) => setBannerForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {["info", "success", "warning", "error"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Audience</label>
                  <select
                    value={bannerForm.audience ?? "all"}
                    onChange={(e) => setBannerForm((p) => ({ ...p, audience: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {["all", "free", "paid"].map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">CTA text (optional)</label>
                  <input
                    value={bannerForm.ctaText ?? ""}
                    onChange={(e) => setBannerForm((p) => ({ ...p, ctaText: e.target.value }))}
                    placeholder="Learn more"
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">CTA URL (optional)</label>
                <input
                  value={bannerForm.ctaUrl ?? ""}
                  onChange={(e) => setBannerForm((p) => ({ ...p, ctaUrl: e.target.value }))}
                  placeholder="https://…"
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-4">
                {[
                  { label: "Active", key: "active" as const },
                  { label: "Dismissable", key: "dismissable" as const },
                ].map(({ label, key }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setBannerForm((p) => ({ ...p, [key]: !p?.[key] }))}
                      className={`w-8 h-4 rounded-full transition-colors relative ${bannerForm[key] ? "bg-indigo-600" : "bg-gray-600"}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${bannerForm[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setBannerForm(null)} className="text-sm text-gray-400 hover:text-gray-200">Cancel</button>
                <button
                  onClick={saveBanner}
                  disabled={savingBanner || !bannerForm.message}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  {savingBanner ? "Saving…" : "Save banner"}
                </button>
              </div>
            </div>
          )}

          {/* Banner list */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {bannersLoading ? (
              <p className="text-gray-500 text-sm p-5">Loading…</p>
            ) : banners.length === 0 ? (
              <p className="text-gray-500 text-sm p-5">No banners created yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
                    <th className="text-left px-5 py-3">Message</th>
                    <th className="text-left px-5 py-3">Type</th>
                    <th className="text-left px-5 py-3">Audience</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {banners.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-700/20">
                      <td className="px-5 py-3 text-gray-200 max-w-xs truncate">{b.message}</td>
                      <td className="px-5 py-3 text-gray-400 capitalize">{b.type}</td>
                      <td className="px-5 py-3 text-gray-400 capitalize">{b.audience}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.active ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}`}>
                          {b.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setBannerForm(b)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 mr-3"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
