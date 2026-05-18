"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Download, Eye, EyeOff, Loader2, FileText, Database, Network } from "lucide-react";

interface DeliveryBundle {
  llmMd: string;
  factsJson: string;
  entitiesJson: string;
}

const FILES = [
  {
    key: "llmMd" as const,
    filename: "llm.md",
    label: "AI Factsheet",
    description: "Markdown factsheet optimized for language model consumption.",
    icon: FileText,
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-50",
  },
  {
    key: "factsJson" as const,
    filename: "facts.json",
    label: "Structured Facts",
    description: "Structured key-value brand facts in JSON format.",
    icon: Database,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-50",
  },
  {
    key: "entitiesJson" as const,
    filename: "entities.json",
    label: "Entity Graph",
    description: "Full entity graph with nodes and relations.",
    icon: Network,
    iconColor: "text-sky-500",
    iconBg: "bg-sky-50",
  },
] as const;

function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DeliveryPanel({ projectId, brandName }: { projectId: string; brandName: string }) {
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<DeliveryBundle | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/delivery/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setBundle(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Intro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-indigo-500" />
            AI Brand Files — {brandName}
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Generate machine-readable files for AI systems. Host{" "}
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">llm.md</code> at{" "}
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">/llm.md</code> on your site
            so AI crawlers can find it.
          </p>
        </CardHeader>
        <CardContent>
          <Button onClick={generate} disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating…</>
            ) : (
              "Generate files"
            )}
          </Button>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </CardContent>
      </Card>

      {/* File cards */}
      {bundle && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Ready to download
          </p>
          {FILES.map((f) => {
            const content = bundle[f.key];
            const lines = content.split("\n").length;
            const chars = content.length;
            const isText = f.filename.endsWith(".md");
            return (
              <Card key={f.key} className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-lg ${f.iconBg} flex items-center justify-center shrink-0`}>
                      <f.icon className={`h-4 w-4 ${f.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-800">{f.filename}</span>
                        <Badge variant="outline" className="text-xs">{f.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{f.description}</p>
                      <p className="text-xs text-slate-400">
                        {lines} lines · {(chars / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setPreview(preview === f.key ? null : f.key)}
                      >
                        {preview === f.key ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() =>
                          downloadText(
                            content,
                            f.filename,
                            isText ? "text/markdown" : "application/json"
                          )
                        }
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                  {preview === f.key && (
                    <pre className="mt-3 text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto max-h-60 whitespace-pre-wrap">
                      {content}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tips */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium text-slate-700">Where to use these files</p>
          <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
            <li>Host <code className="bg-white px-1 rounded">llm.md</code> at <code className="bg-white px-1 rounded">yourdomain.com/llm.md</code></li>
            <li>Submit <code className="bg-white px-1 rounded">facts.json</code> to AI index providers</li>
            <li>Embed <code className="bg-white px-1 rounded">entities.json</code> in your site's <code className="bg-white px-1 rounded">&lt;head&gt;</code> as JSON-LD</li>
            <li>Regenerate after publishing new content or updating your entity graph</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
