"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BarChart3, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import StepProjectBasics from "@/components/onboarding/step-project-basics";
import StepPrompts from "@/components/onboarding/step-prompts";
import StepCompetitors from "@/components/onboarding/step-competitors";
import type { ProjectBasics, PromptItem, CompetitorItem } from "@/lib/onboarding-types";

const STEPS = [
  { number: 1, label: "Project basics" },
  { number: 2, label: "Add prompts" },
  { number: 3, label: "Add competitors" },
];

// ---------------------------------------------------------------------------
// Inner component (reads searchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gscConnected, setGscConnected] = useState(false);

  const [basics, setBasics] = useState<ProjectBasics>({
    name: "",
    websiteUrl: "",
    brandName: "",
    businessCategory: "",
    city: "",
  });
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorItem[]>([
    { id: crypto.randomUUID(), brandName: "", websiteUrl: "" },
  ]);

  // ── Handle return from GSC OAuth ─────────────────────────────────────────
  useEffect(() => {
    const gscParam = searchParams.get("gsc");
    const stepParam = searchParams.get("step");

    if (gscParam === "connected" && stepParam === "2") {
      // Restore project basics that were saved before OAuth redirect
      const saved = localStorage.getItem("onboarding-basics");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ProjectBasics;
          setBasics(parsed);
          localStorage.removeItem("onboarding-basics");
        } catch {
          // ignore parse errors
        }
      }
      setGscConnected(true);
      setStep(2);
    } else if (gscParam === "error" && stepParam === "2") {
      toast.error("Failed to connect Google Search Console. Please try again.");
      setStep(2);
    }
  }, [searchParams]);

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  async function handleFinish(finalCompetitors: CompetitorItem[]) {
    setIsSubmitting(true);
    try {
      const selectedPrompts = prompts.filter((p) => p.selected);

      const createRes = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: basics.name,
          websiteUrl: basics.websiteUrl,
          brandName: basics.brandName,
          businessCategory: basics.businessCategory,
          city: basics.city,
          prompts: selectedPrompts.map((p) => ({
            text: p.text,
            category: p.category,
          })),
          competitors: finalCompetitors
            .filter((c) => c.brandName.trim())
            .map((c) => ({
              brandName: c.brandName.trim(),
              websiteUrl: c.websiteUrl.trim(),
            })),
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        toast.error(createData.error ?? "Failed to create project.");
        return;
      }

      const { projectId } = createData;

      fetch("/api/scan/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      }).catch(() => {});

      toast.success("Your first scan is running. Results in ~5 minutes.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-lg">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">BlockBoost</span>
        </div>
        <span className="ml-4 text-sm text-slate-400">Set up your first project</span>
      </header>

      <div className="flex-1 flex flex-col items-center py-10 px-4">
        {/* Step indicator */}
        <div className="w-full max-w-2xl mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((s, idx) => (
              <div key={s.number} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                      step > s.number
                        ? "bg-indigo-600 text-white"
                        : step === s.number
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {step > s.number ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.number
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium hidden sm:block transition-colors ${
                      step >= s.number ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 h-px mx-3 hidden sm:block">
                    <div
                      className={`h-full transition-colors duration-300 ${
                        step > s.number ? "bg-indigo-300" : "bg-slate-200"
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <Progress
            value={progressPct}
            className="h-1.5 bg-slate-200 [&>div]:bg-indigo-600 [&>div]:transition-all [&>div]:duration-300"
          />
          <div className="flex justify-between mt-1.5">
            <p className="text-xs text-slate-400">Step {step} of {STEPS.length}</p>
            <p className="text-xs text-slate-400">{Math.round(progressPct)}% complete</p>
          </div>
        </div>

        {/* Step content */}
        <div className="w-full max-w-2xl">
          {step === 1 && (
            <StepProjectBasics
              basics={basics}
              onChange={setBasics}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepPrompts
              basics={basics}
              prompts={prompts}
              onChange={setPrompts}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
              gscConnected={gscConnected}
            />
          )}
          {step === 3 && (
            <StepCompetitors
              competitors={competitors}
              onChange={setCompetitors}
              onBack={() => setStep(2)}
              onFinish={handleFinish}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps content in Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
