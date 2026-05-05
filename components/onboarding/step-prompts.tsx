"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight, ArrowLeft, MessageSquare, Loader2, Plus, Trash2,
  Sparkles, RefreshCw, ChevronDown, ChevronRight, Database,
} from "lucide-react";
import { GscImportPanel } from "./gsc-import-panel";
import type { ProjectBasics, PromptItem } from "@/lib/onboarding-types";

interface Props {
  basics: ProjectBasics;
  prompts: PromptItem[];
  onChange: (prompts: PromptItem[]) => void;
  onBack: () => void;
  onNext: () => void;
  gscConnected?: boolean; // true when returning from OAuth
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  awareness:     { label: "Awareness",     color: "bg-blue-50 text-blue-700 border-blue-200" },
  comparison:    { label: "Comparison",    color: "bg-purple-50 text-purple-700 border-purple-200" },
  purchase:      { label: "Purchase",      color: "bg-green-50 text-green-700 border-green-200" },
  local:         { label: "Local",         color: "bg-orange-50 text-orange-700 border-orange-200" },
  informational: { label: "Informational", color: "bg-slate-50 text-slate-600 border-slate-200" },
  custom:        { label: "Custom",        color: "bg-orange-50 text-orange-700 border-orange-200" },
};

function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("near me") || lower.includes("in ")) return "local";
  if (lower.includes("how to") || lower.includes("what is") || lower.includes("why")) return "informational";
  if (lower.includes("vs") || lower.includes("compare") || lower.includes("alternative") || lower.includes("difference")) return "comparison";
  if (lower.includes("buy") || lower.includes("price") || lower.includes("cost") || lower.includes("plan") || lower.includes("worth")) return "purchase";
  return "awareness";
}

// Minimal Google logo
function GoogleLogo() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function StepPrompts({ basics, prompts, onChange, onBack, onNext, gscConnected = false }: Props) {
  // Section visibility
  const [manualOpen, setManualOpen] = useState(!gscConnected);
  const [isLoading, setIsLoading] = useState(false);
  const [customText, setCustomText] = useState("");
  const [error, setError] = useState("");
  const hasFetched = useRef(false);

  const selectedCount = prompts.filter((p) => p.selected).length;
  const MIN_PROMPTS = 3;

  // Fetch AI suggestions once when manual section opens (if not already loaded)
  useEffect(() => {
    if (hasFetched.current || prompts.length > 0) return;
    hasFetched.current = true;
    fetchSuggestions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSuggestions() {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects/suggest-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: basics.websiteUrl, brandName: basics.brandName }),
      });
      const data = await res.json();
      const suggested: string[] = data.prompts ?? [];
      // Only add if prompts list is still empty (don't overwrite GSC imports)
      onChange(
        suggested.map((text, i) => ({
          id: `suggested-${i}`,
          text,
          category: guessCategory(text),
          selected: true,
          isCustom: false,
        }))
      );
    } catch {
      setError("Failed to load AI suggestions. Add prompts manually below.");
    } finally {
      setIsLoading(false);
    }
  }

  function togglePrompt(id: string) {
    onChange(prompts.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  }

  function removePrompt(id: string) {
    onChange(prompts.filter((p) => p.id !== id));
  }

  function addCustomPrompt() {
    const text = customText.trim();
    if (!text) return;
    onChange([
      ...prompts,
      { id: `custom-${Date.now()}`, text, category: "custom", selected: true, isCustom: true },
    ]);
    setCustomText("");
  }

  // Called by GscImportPanel when user clicks "Add N queries"
  function handleGscImported(newPrompts: PromptItem[]) {
    // Deduplicate by text
    const existingTexts = new Set(prompts.map((p) => p.text.toLowerCase()));
    const fresh = newPrompts.filter((p) => !existingTexts.has(p.text.toLowerCase()));
    onChange([...prompts, ...fresh]);
    // Auto-expand the prompt list so user sees what was added
    setManualOpen(true);
  }

  function handleNext() {
    if (selectedCount < MIN_PROMPTS) {
      setError(`Select at least ${MIN_PROMPTS} prompts to continue.`);
      return;
    }
    setError("");
    onNext();
  }

  // Save basics to sessionStorage before GSC redirect so we can restore them after OAuth
  function handleConnectGSC() {
    sessionStorage.setItem("onboarding-basics", JSON.stringify(basics));
    window.location.href = "/api/auth/gsc/connect?source=onboarding";
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <CardTitle className="text-xl text-slate-900">Choose your tracking prompts</CardTitle>
            <CardDescription className="text-slate-500 mt-0.5">
              Questions customers ask AI tools — we check if{" "}
              <strong className="text-slate-700">{basics.brandName}</strong> appears in answers.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* ── Option A: GSC Import (recommended) ────────────────────────── */}
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/30 overflow-hidden">
          {/* Header */}
          <div className="flex items-start gap-3 px-4 pt-4 pb-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
              <GoogleLogo />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">Import from Google Search Console</p>
                <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0 border-none">
                  Recommended
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                GSC queries = real questions your customers already search. These make the best AEO tracking prompts.
              </p>
            </div>
          </div>

          <div className="px-4 pb-4">
            {gscConnected ? (
              <GscImportPanel basics={basics} onImported={handleGscImported} />
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2.5 flex items-start gap-2">
                  <Database className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600">
                    Connect GSC to automatically import your top 50 organic search queries —
                    filtered for intent, categorized by AI, and ready to track.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleConnectGSC}
                  className="gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <GoogleLogo />
                  Connect Google Search Console
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Option B: Manual / AI suggestions (collapsible) ───────────── */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">
                {gscConnected ? "Also add AI-suggested prompts" : "Add prompts manually / AI suggestions"}
              </span>
            </div>
            {manualOpen
              ? <ChevronDown className="h-4 w-4 text-slate-400" />
              : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>

          {manualOpen && (
            <div className="px-4 pb-4 pt-3 space-y-4">
              {/* AI suggestion controls */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  AI-suggested prompts based on <strong>{basics.brandName}</strong>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-slate-500 gap-1.5"
                  onClick={() => { hasFetched.current = false; fetchSuggestions(); }}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerate
                </Button>
              </div>

              {isLoading && (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  Generating prompts for <strong>{basics.brandName}</strong>…
                </div>
              )}

              {/* Suggestion chips (show only AI/non-GSC prompts here) */}
              {!isLoading && prompts.filter((p) => !p.id.startsWith("gsc-")).length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {prompts
                    .filter((p) => !p.id.startsWith("gsc-"))
                    .map((prompt) => {
                      const cat = CATEGORY_LABELS[prompt.category] ?? CATEGORY_LABELS.custom;
                      return (
                        <div
                          key={prompt.id}
                          onClick={() => togglePrompt(prompt.id)}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            prompt.selected
                              ? "border-indigo-300 bg-indigo-50/70"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div
                            className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                              prompt.selected ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"
                            }`}
                          >
                            {prompt.selected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <p className={`flex-1 text-sm leading-snug ${prompt.selected ? "text-slate-800" : "text-slate-500"}`}>
                            {prompt.text}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${cat.color}`}>
                              {cat.label}
                            </Badge>
                            {prompt.isCustom && (
                              <button
                                onClick={(e) => { e.stopPropagation(); removePrompt(prompt.id); }}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Add custom prompt */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Add a custom prompt</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. What CRM should I use for a SaaS startup?"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomPrompt(); } }}
                    className="h-10 border-slate-300 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCustomPrompt}
                    disabled={!customText.trim()}
                    className="h-10 px-3 border-slate-300"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Unified prompt count summary ──────────────────────────────── */}
        {prompts.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5">
            <p className="text-sm font-medium text-slate-700">
              <span className="text-indigo-600 font-bold">{selectedCount}</span> of {prompts.length} prompts selected
              {selectedCount < MIN_PROMPTS && (
                <span className="text-red-500 ml-1.5 font-normal">(need at least {MIN_PROMPTS})</span>
              )}
            </p>
            {/* Quick GSC count badge */}
            {prompts.some((p) => p.id.startsWith("gsc-")) && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 gap-1">
                <GoogleLogo />
                {prompts.filter((p) => p.id.startsWith("gsc-")).length} from GSC
              </Badge>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Navigation */}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={onBack} className="h-11 border-slate-300 text-slate-600">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={isLoading}
            className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
