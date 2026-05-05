"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, ArrowRight } from "lucide-react";
import type { ProjectBasics } from "@/lib/onboarding-types";

interface Props {
  basics: ProjectBasics;
  onChange: (basics: ProjectBasics) => void;
  onNext: () => void;
}

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export default function StepProjectBasics({ basics, onChange, onNext }: Props) {
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectBasics, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ProjectBasics, boolean>>>({});

  function validate(data: ProjectBasics): Partial<Record<keyof ProjectBasics, string>> {
    const errs: Partial<Record<keyof ProjectBasics, string>> = {};
    if (!data.name.trim()) errs.name = "Project name is required.";
    if (!data.websiteUrl.trim()) {
      errs.websiteUrl = "Website URL is required.";
    } else if (!isValidUrl(data.websiteUrl)) {
      errs.websiteUrl = "Enter a valid URL (e.g. https://acmecorp.com).";
    }
    if (!data.brandName.trim()) errs.brandName = "Brand name is required.";
    return errs;
  }

  function handleChange(field: keyof ProjectBasics, value: string) {
    const next = { ...basics, [field]: value };
    onChange(next);
    if (touched[field]) {
      setErrors(validate(next));
    }
  }

  function handleBlur(field: keyof ProjectBasics) {
    const normalised = field === "websiteUrl" ? normaliseUrl(basics[field]) : basics[field];
    const next = { ...basics, [field]: normalised };
    onChange(next);
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(next));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normUrl = normaliseUrl(basics.websiteUrl);
    const next = { ...basics, websiteUrl: normUrl };
    onChange(next);
    setTouched({ name: true, websiteUrl: true, brandName: true });
    const errs = validate(next);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onNext();
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Globe className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <CardTitle className="text-xl text-slate-900">Tell us about your brand</CardTitle>
            <CardDescription className="text-slate-500 mt-0.5">
              We&apos;ll use this to identify your brand across AI responses.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-slate-700 font-medium">
              Project name
            </Label>
            <Input
              id="name"
              placeholder="e.g. Acme Corp — Main"
              value={basics.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              className={`h-11 border-slate-300 ${errors.name ? "border-red-400 focus-visible:ring-red-300" : ""}`}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
            <p className="text-xs text-slate-400">
              A label for this tracking project — you can have multiple.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="websiteUrl" className="text-slate-700 font-medium">
              Your website URL
            </Label>
            <Input
              id="websiteUrl"
              type="url"
              placeholder="https://acmecorp.com"
              value={basics.websiteUrl}
              onChange={(e) => handleChange("websiteUrl", e.target.value)}
              onBlur={() => handleBlur("websiteUrl")}
              className={`h-11 border-slate-300 ${errors.websiteUrl ? "border-red-400 focus-visible:ring-red-300" : ""}`}
            />
            {errors.websiteUrl && (
              <p className="text-xs text-red-500">{errors.websiteUrl}</p>
            )}
            <p className="text-xs text-slate-400">
              Used to identify owned citations in AI responses.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brandName" className="text-slate-700 font-medium">
              Brand name
            </Label>
            <Input
              id="brandName"
              placeholder="e.g. Acme Corp"
              value={basics.brandName}
              onChange={(e) => handleChange("brandName", e.target.value)}
              onBlur={() => handleBlur("brandName")}
              className={`h-11 border-slate-300 ${errors.brandName ? "border-red-400 focus-visible:ring-red-300" : ""}`}
            />
            {errors.brandName && (
              <p className="text-xs text-red-500">{errors.brandName}</p>
            )}
            <p className="text-xs text-slate-400">
              Exactly how your brand appears in AI responses — used for matching.
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
