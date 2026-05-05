"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Check, Zap, Code2 } from "lucide-react";

type SchemaType = "FAQPage" | "Article" | "HowTo" | "Product";

const SCHEMA_META: Record<SchemaType, { label: string; placeholder: string; tip: string }> = {
  FAQPage: {
    label: "FAQPage",
    placeholder: `Paste your FAQ content or list questions and answers:

Q: What is your return policy?
A: We offer a 30-day money-back guarantee on all purchases.

Q: Do you offer customer support?
A: Yes, we provide 24/7 email and live chat support.`,
    tip: "List questions ending with '?' and answers on the next line.",
  },
  Article: {
    label: "Article",
    placeholder: `Paste your article title and excerpt:

Title: The Complete Guide to AEO Optimization
Author: Jane Smith
Published: 2026-01-15

AI-driven search is reshaping how people find information online...`,
    tip: "Include title, author, date, and a content excerpt for best results.",
  },
  HowTo: {
    label: "HowTo",
    placeholder: `Paste your how-to steps:

How to Set Up Your Account

1. Navigate to the signup page
2. Enter your email address
3. Create a strong password
4. Verify your email
5. Complete your profile`,
    tip: "Number your steps clearly for accurate extraction.",
  },
  Product: {
    label: "Product",
    placeholder: `Paste your product details:

Product: VisibilityIQ Pro
Brand: VisibilityIQ
Price: $299/month
Description: Track your brand across all AI platforms in real time.
Availability: In Stock`,
    tip: "Include name, price, brand, and a description.",
  },
};

interface Props {
  brandName?: string;
  pageUrl?: string;
}

export function SchemaGenerator({ brandName, pageUrl }: Props) {
  const [schemaType, setSchemaType] = useState<SchemaType>("FAQPage");
  const [content, setContent] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wasAiGenerated, setWasAiGenerated] = useState(false);

  const meta = SCHEMA_META[schemaType];

  async function handleGenerate() {
    if (!content.trim()) { setError("Please paste some content first."); return; }
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const res = await fetch("/api/audit/generate-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), schemaType, brandName, pageUrl }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Generation failed");
      }
      const data = await res.json() as { schema: string; generated: boolean };
      // Pretty-print
      try {
        setOutput(JSON.stringify(JSON.parse(data.schema), null, 2));
      } catch {
        setOutput(data.schema);
      }
      setWasAiGenerated(data.generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!output) return;
    // Wrap in script tag for ready-to-paste output
    const wrapped = `<script type="application/ld+json">\n${output}\n</script>`;
    await navigator.clipboard.writeText(wrapped).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-5">
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Code2 className="h-4 w-4 text-indigo-500" />
            Schema Generator
          </CardTitle>
          <p className="text-xs text-slate-500">
            Paste your page content, select a schema type, and generate valid JSON-LD markup ready to copy into your &lt;head&gt;.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Schema type selector */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Schema type</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SCHEMA_META) as SchemaType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => { setSchemaType(type); setOutput(null); setError(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    schemaType === type
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-300 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {SCHEMA_META[type].label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">{meta.tip}</p>
          </div>

          {/* Content textarea */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Your content</p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={meta.placeholder}
              rows={10}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y font-mono leading-relaxed"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button
            onClick={handleGenerate}
            disabled={loading || !content.trim()}
            className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {loading ? "Generating schema…" : "Generate Schema"}
          </Button>
        </CardContent>
      </Card>

      {/* Output */}
      {output && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Generated {schemaType} Schema
              </CardTitle>
              <div className="flex items-center gap-2">
                {wasAiGenerated ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200">
                    AI-generated
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-500 border-slate-200">
                    Template
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-8 text-xs border-slate-300 text-slate-600 gap-1.5"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy with <script> tag"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Add this inside your page&apos;s <code className="font-mono bg-slate-100 px-1 rounded">&lt;head&gt;</code> or at the bottom of <code className="font-mono bg-slate-100 px-1 rounded">&lt;body&gt;</code>.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative">
              <pre className="overflow-x-auto p-4 text-[12px] font-mono text-green-400 bg-slate-950 rounded-b-xl max-h-96 leading-relaxed">
                {`<script type="application/ld+json">\n${output}\n</script>`}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
