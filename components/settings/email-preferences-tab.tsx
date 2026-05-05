"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface EmailPrefs {
  emailPrefWeeklyReport: boolean;
  emailPrefMonthlySummary: boolean;
  emailPrefFeatureNews: boolean;
  emailPrefAlerts: boolean;
  emailPrefTips: boolean;
}

interface Props {
  initialPrefs: EmailPrefs;
}

const PREFS = [
  {
    key: "emailPrefWeeklyReport" as const,
    label: "Weekly reports",
    description: "Your AI visibility summary sent every Monday",
  },
  {
    key: "emailPrefMonthlySummary" as const,
    label: "Monthly summary",
    description: "Month-over-month trends and highlights on the 1st of each month",
  },
  {
    key: "emailPrefTips" as const,
    label: "Tips & guides",
    description: "Actionable tips on improving your AI visibility score",
  },
  {
    key: "emailPrefAlerts" as const,
    label: "Alerts",
    description: "Notifications when your mention rate changes significantly",
  },
  {
    key: "emailPrefFeatureNews" as const,
    label: "Feature updates",
    description: "New features, improvements, and product announcements",
  },
];

export default function EmailPreferencesTab({ initialPrefs }: Props) {
  const [prefs, setPrefs] = useState<EmailPrefs>(initialPrefs);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/email-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Email preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof EmailPrefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Email preferences</CardTitle>
          <CardDescription>
            Choose which emails you receive from BlockBoost. Billing and
            account-security emails are always sent regardless of these
            settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {PREFS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor={key} className="text-sm font-medium leading-none">
                  {label}
                </Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                id={key}
                checked={prefs[key]}
                onCheckedChange={() => toggle(key)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          You can also unsubscribe via the link at the bottom of any email.
        </p>
        <Button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
