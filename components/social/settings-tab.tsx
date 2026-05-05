"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

interface SocialSettings {
  redditEnabled: boolean;
  quoraEnabled: boolean;
  linkedinEnabled: boolean;
  monitorKeywords: string[];
  excludeKeywords: string[];
  targetSubreddits: string[];
  minimumUpvotes: number;
  minimumAICitationScore: number;
  notifyOnNew: boolean;
}

interface Props {
  projectId: string;
  initialSettings: SocialSettings | null;
  suggestedSubreddits: string[];
  autoKeywords: string[];
}

export default function SocialSettingsTab({
  projectId,
  initialSettings,
  suggestedSubreddits,
  autoKeywords,
}: Props) {
  const [settings, setSettings] = useState<SocialSettings>(
    initialSettings ?? {
      redditEnabled: true,
      quoraEnabled: false,
      linkedinEnabled: false,
      monitorKeywords: [],
      excludeKeywords: [],
      targetSubreddits: [],
      minimumUpvotes: 5,
      minimumAICitationScore: 40,
      notifyOnNew: true,
    }
  );
  const [saving, setSaving] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newExclude, setNewExclude] = useState("");
  const [newSubreddit, setNewSubreddit] = useState("");

  function addKeyword(kw: string, field: "monitorKeywords" | "excludeKeywords" | "targetSubreddits") {
    const trimmed = kw.trim().replace(/^r\//, "");
    if (!trimmed || settings[field].includes(trimmed)) return;
    setSettings((s) => ({ ...s, [field]: [...s[field], trimmed] }));
  }

  function removeItem(field: "monitorKeywords" | "excludeKeywords" | "targetSubreddits", item: string) {
    setSettings((s) => ({ ...s, [field]: s[field].filter((k) => k !== item) }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/social/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...settings }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Platform toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platforms</CardTitle>
          <CardDescription>Choose which platforms to monitor for opportunities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "redditEnabled" as const, label: "Reddit", desc: "Threads and posts from Reddit communities" },
            { key: "quoraEnabled" as const, label: "Quora", desc: "Questions and answers on Quora topics" },
            { key: "linkedinEnabled" as const, label: "LinkedIn", desc: "Professional posts and discussions" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={settings[key]}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, [key]: v }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Monitor keywords */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monitoring keywords</CardTitle>
          <CardDescription>
            We scan these keywords across platforms daily. Gray tags are auto-generated from your prompts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {autoKeywords.map((kw) => (
              <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                {kw}
                <span className="text-slate-400 text-xs">auto</span>
              </span>
            ))}
            {settings.monitorKeywords.map((kw) => (
              <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                {kw}
                <button onClick={() => removeItem("monitorKeywords", kw)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { addKeyword(newKeyword, "monitorKeywords"); setNewKeyword(""); } }}
              placeholder="Add custom keyword…"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => { addKeyword(newKeyword, "monitorKeywords"); setNewKeyword(""); }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Target subreddits */}
      {settings.redditEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Target subreddits</CardTitle>
            <CardDescription>Monitor specific subreddits relevant to your business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestedSubreddits.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Suggested based on your business type:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedSubreddits.map((sr) => (
                    <button
                      key={sr}
                      onClick={() => addKeyword(sr, "targetSubreddits")}
                      disabled={settings.targetSubreddits.includes(sr)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-slate-200 text-slate-600 hover:border-amber-400 hover:text-amber-600 disabled:opacity-40 disabled:cursor-default transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      r/{sr}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {settings.targetSubreddits.map((sr) => (
                <span key={sr} className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                  r/{sr}
                  <button onClick={() => removeItem("targetSubreddits", sr)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubreddit}
                onChange={(e) => setNewSubreddit(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { addKeyword(newSubreddit, "targetSubreddits"); setNewSubreddit(""); } }}
                placeholder="r/subredditname"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <Button size="sm" variant="outline" onClick={() => { addKeyword(newSubreddit, "targetSubreddits"); setNewSubreddit(""); }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Minimum thresholds</CardTitle>
          <CardDescription>Filter out low-quality opportunities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="flex justify-between mb-1">
              <Label className="text-sm">Minimum AI citation score</Label>
              <span className="text-sm font-bold text-amber-600">{settings.minimumAICitationScore}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.minimumAICitationScore}
              onChange={(e) => setSettings((s) => ({ ...s, minimumAICitationScore: parseInt(e.target.value) }))}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <Label className="text-sm">Minimum upvotes</Label>
              <span className="text-sm font-bold text-amber-600">{settings.minimumUpvotes}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.minimumUpvotes}
              onChange={(e) => setSettings((s) => ({ ...s, minimumUpvotes: parseInt(e.target.value) }))}
              className="w-full accent-amber-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Notify me of new opportunities</Label>
              <p className="text-xs text-muted-foreground">Get alerted when high-scoring threads are found</p>
            </div>
            <Switch
              checked={settings.notifyOnNew}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, notifyOnNew: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={saving}
          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold"
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
