"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  Share2,
  CheckCircle,
  Loader2,
  Calendar,
  X,
  Sparkles,
  BarChart3,
  TrendingUp,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { subDays, subMonths, format, startOfMonth, endOfMonth } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Period = "7d" | "30d" | "90d" | "custom";

interface GenerateReportModalProps {
  projectId: string;
  brandName: string;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerateReportModal({
  projectId,
  brandName,
  open,
  onClose,
}: GenerateReportModalProps) {
  const [period, setPeriod] = useState<Period>("30d");
  const [customStart, setCustomStart] = useState(
    format(subMonths(new Date(), 1), "yyyy-MM-dd"),
  );
  const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [step, setStep] = useState<"config" | "generating" | "done">("config");
  const [result, setResult] = useState<{
    pdfUrl: string | null;
    shareUrl: string;
    reportId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const PERIODS: { value: Period; label: string; sub: string }[] = [
    { value: "7d", label: "Last 7 days", sub: "Weekly snapshot" },
    { value: "30d", label: "Last 30 days", sub: "Monthly overview" },
    { value: "90d", label: "Last 90 days", sub: "Quarterly review" },
    { value: "custom", label: "Custom range", sub: "Choose your own dates" },
  ];

  const FEATURES = [
    { icon: BarChart3, label: "Platform performance breakdown" },
    { icon: TrendingUp, label: "Wins & gaps analysis" },
    { icon: Sparkles, label: "AI-generated narrative & roadmap" },
    { icon: Link2, label: "Citation analysis" },
  ];

  function getDateRange() {
    const now = new Date();
    if (period === "7d") return { start: subDays(now, 7), end: now };
    if (period === "30d") return { start: subDays(now, 30), end: now };
    if (period === "90d") return { start: subDays(now, 90), end: now };
    return { start: new Date(customStart), end: new Date(customEnd) };
  }

  async function handleGenerate() {
    setStep("generating");
    try {
      const { start, end } = getDateRange();
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          reportType: "ONDEMAND",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to generate report");
        setStep("config");
        return;
      }
      setResult({
        pdfUrl: json.pdfUrl,
        shareUrl: json.shareUrl,
        reportId: json.reportId,
      });
      setStep("done");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setStep("config");
    }
  }

  function handleCopy() {
    if (!result?.shareUrl) return;
    navigator.clipboard.writeText(result.shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleClose() {
    setStep("config");
    setResult(null);
    setCopied(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Generate Report</h2>
              <p className="text-indigo-200 text-xs">{brandName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-indigo-200 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* ─── Step: Config ─── */}
          {step === "config" && (
            <div className="space-y-6">
              {/* Period selector */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">Select period</p>
                <div className="grid grid-cols-2 gap-2">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPeriod(p.value)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        period === p.value
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-semibold text-sm block">{p.label}</span>
                      <span className="text-xs opacity-70">{p.sub}</span>
                    </button>
                  ))}
                </div>

                {/* Custom date pickers */}
                {period === "custom" && (
                  <div className="mt-3 flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">From</label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">To</label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Feature checklist */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  This report includes
                </p>
                <div className="space-y-2">
                  {FEATURES.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 bg-indigo-50 rounded-md flex items-center justify-center shrink-0">
                        <Icon className="w-3 h-3 text-indigo-500" />
                      </div>
                      <span className="text-sm text-slate-600">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate Report
              </button>
            </div>
          )}

          {/* ─── Step: Generating ─── */}
          {step === "generating" && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-lg">Generating your report…</p>
                <p className="text-slate-500 text-sm mt-1">
                  Compiling data, running AI analysis, rendering PDF
                </p>
              </div>
              <div className="space-y-2 w-full max-w-xs text-left">
                {[
                  "Fetching mention data",
                  "Calculating platform rates",
                  "Running AI narrative",
                  "Rendering PDF",
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Step: Done ─── */}
          {step === "done" && result && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <p className="font-bold text-slate-900 text-lg">Report ready!</p>
                <p className="text-slate-500 text-sm mt-1">
                  Your report has been generated and is ready to share.
                </p>
              </div>

              {/* Share link */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Share link
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 truncate font-mono">
                    {result.shareUrl}
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      copied
                        ? "bg-green-100 text-green-700"
                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    }`}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {result.pdfUrl && (
                  <a
                    href={result.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </a>
                )}
                <a
                  href={result.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  <Share2 className="w-4 h-4" />
                  View report
                </a>
              </div>

              <button
                onClick={handleClose}
                className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors pt-1"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
