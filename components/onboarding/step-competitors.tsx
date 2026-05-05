"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users2, Plus, Trash2, Loader2, Rocket } from "lucide-react";
import type { CompetitorItem } from "@/lib/onboarding-types";

interface Props {
  competitors: CompetitorItem[];
  onChange: (competitors: CompetitorItem[]) => void;
  onBack: () => void;
  onFinish: (competitors: CompetitorItem[]) => void;
  isSubmitting: boolean;
}

const MAX_COMPETITORS = 5;

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function StepCompetitors({
  competitors,
  onChange,
  onBack,
  onFinish,
  isSubmitting,
}: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function addRow() {
    if (competitors.length >= MAX_COMPETITORS) return;
    onChange([
      ...competitors,
      { id: crypto.randomUUID(), brandName: "", websiteUrl: "" },
    ]);
  }

  function removeRow(id: string) {
    onChange(competitors.filter((c) => c.id !== id));
  }

  function updateRow(id: string, field: "brandName" | "websiteUrl", value: string) {
    onChange(
      competitors.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
    // Clear error on change
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${id}-${field}`];
      return next;
    });
  }

  function blurUrl(id: string, raw: string) {
    const normalised = normaliseUrl(raw);
    updateRow(id, "websiteUrl", normalised);
    if (normalised && !/^https?:\/\/.+\..+/.test(normalised)) {
      setErrors((prev) => ({ ...prev, [`${id}-websiteUrl`]: "Enter a valid URL" }));
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    competitors.forEach((c) => {
      if (c.websiteUrl && !/^https?:\/\/.+\..+/.test(normaliseUrl(c.websiteUrl))) {
        errs[`${c.id}-websiteUrl`] = "Enter a valid URL";
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleFinish() {
    if (!validate()) return;
    const final = competitors.map((c) => ({
      ...c,
      websiteUrl: normaliseUrl(c.websiteUrl),
    }));
    onFinish(final);
  }

  const filledCount = competitors.filter((c) => c.brandName.trim()).length;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Users2 className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <CardTitle className="text-xl text-slate-900">Track your competitors</CardTitle>
            <CardDescription className="text-slate-500 mt-0.5">
              We&apos;ll show when AI models recommend them instead of you.
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
            Up to {MAX_COMPETITORS} on your plan
          </Badge>
          {filledCount > 0 && (
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
              {filledCount} added
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_36px] gap-2 px-1">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Brand name <span className="text-red-400">*</span>
          </Label>
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Website URL <span className="text-slate-400">(optional)</span>
          </Label>
          <div />
        </div>

        {/* Competitor rows */}
        <div className="space-y-2.5">
          {competitors.map((c, idx) => (
            <div key={c.id} className="grid grid-cols-[1fr_1fr_36px] gap-2 items-start">
              <div>
                <Input
                  placeholder={`Competitor ${idx + 1}`}
                  value={c.brandName}
                  onChange={(e) => updateRow(c.id, "brandName", e.target.value)}
                  className="h-10 border-slate-300 text-sm"
                />
              </div>
              <div>
                <Input
                  placeholder="https://rival.com"
                  value={c.websiteUrl}
                  onChange={(e) => updateRow(c.id, "websiteUrl", e.target.value)}
                  onBlur={(e) => blurUrl(c.id, e.target.value)}
                  className={`h-10 border-slate-300 text-sm ${
                    errors[`${c.id}-websiteUrl`] ? "border-red-400" : ""
                  }`}
                />
                {errors[`${c.id}-websiteUrl`] && (
                  <p className="text-[11px] text-red-500 mt-0.5">{errors[`${c.id}-websiteUrl`]}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(c.id)}
                disabled={competitors.length === 1}
                className="h-10 w-9 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add row */}
        {competitors.length < MAX_COMPETITORS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="h-9 border-dashed border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 w-full"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add competitor
          </Button>
        )}
        {competitors.length >= MAX_COMPETITORS && (
          <p className="text-xs text-slate-400 text-center">
            Maximum {MAX_COMPETITORS} competitors on your current plan.{" "}
            <a href="/dashboard/settings" className="text-indigo-600 hover:underline">
              Upgrade
            </a>{" "}
            for more.
          </p>
        )}

        {/* Skip hint */}
        <p className="text-xs text-slate-400 text-center">
          No competitors yet? That&apos;s fine — you can add them later from Settings.
        </p>

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            className="h-11 border-slate-300 text-slate-600"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleFinish}
            disabled={isSubmitting}
            className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating project…
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Launch first scan
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
