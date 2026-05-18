/**
 * ReportGeneratorInline — replaces the modal-based generate flow with an
 * inline period picker.
 *
 * Before: click "Generate Report" → modal opens → pick period → click
 * "Generate Report" again → modal shows 3 buttons after success.
 *
 * After: pick a period inline (4 buttons), click one Generate, see an
 * inline progress row, then get a single toast that auto-copies the share
 * link. Total clicks: 2 (period + generate). No modal at all.
 *
 * U7 + U8 from SPRINT_UI.md.
 */
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { subDays } from "date-fns";

type Period = "7d" | "30d" | "90d";

const PERIODS: { value: Period; label: string; days: number }[] = [
  { value: "7d",  label: "7 days",  days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
];

interface Props {
  projectId: string;
  brandName: string;
  onGenerated: () => void;
}

export function ReportGeneratorInline({ projectId, brandName, onGenerated }: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [step, setStep] = useState<"idle" | "generating">("idle");
  const [stage, setStage] = useState(0);

  function getRange() {
    const now = new Date();
    const days = PERIODS.find((p) => p.value === period)?.days ?? 30;
    return { start: subDays(now, days), end: now };
  }

  async function handleGenerate() {
    setStep("generating");
    setStage(0);

    // Visually walk through the stages while the request is in flight.
    // Each stage advances ~6s; the actual generation usually beats it.
    const stageInterval = window.setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      6000,
    );

    try {
      const { start, end } = getRange();
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
        setStep("idle");
        return;
      }

      const shareUrl = json.shareUrl as string;

      // U8 — auto-copy + single-action toast
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        /* clipboard blocked (e.g. iframe) — toast still works */
      }

      toast.success("Report ready · link copied", {
        description: brandName,
        duration: 8000,
        action: {
          label: "View",
          onClick: () => window.open(shareUrl, "_blank", "noopener"),
        },
      });

      setStep("idle");
      onGenerated();
    } catch {
      toast.error("Something went wrong. Please try again.");
      setStep("idle");
    } finally {
      window.clearInterval(stageInterval);
    }
  }

  if (step === "generating") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <Loader2 className="h-4 w-4 text-slate-500 animate-spin shrink-0" />
        <span className="text-sm text-slate-600">{STAGES[stage]}…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
        {PERIODS.map((p, i) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              period === p.value
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            } ${i > 0 ? "border-l border-slate-200" : ""}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        onClick={handleGenerate}
        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors"
      >
        Generate
      </button>
    </div>
  );
}

const STAGES = [
  "Fetching mention data",
  "Calculating platform rates",
  "Running AI narrative",
  "Rendering PDF",
];
