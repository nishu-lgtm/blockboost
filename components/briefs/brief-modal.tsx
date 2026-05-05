"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Copy, Check, ExternalLink, ChevronDown, ChevronRight,
  BookOpen, Zap, AlignLeft, List, HelpCircle, Code2,
  Link2, Hash, Award, Target, Layers,
} from "lucide-react";
import type { BriefRow } from "@/lib/brief-types";

// ---------------------------------------------------------------------------
// Quality score ring
// ---------------------------------------------------------------------------

function QualityRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs work";
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-12 h-12">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
          <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-700">Brief Quality Score</p>
        <p className="text-[11px]" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyBtn({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <Button size="sm" variant="outline" onClick={handleCopy}
      className={`h-7 text-xs border-slate-300 text-slate-600 gap-1.5 ${className}`}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  icon, title, badge, children, copyText, defaultOpen = true,
}: {
  icon: React.ReactNode; title: string; badge?: string;
  children: React.ReactNode; copyText?: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-500">{icon}</span>
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          {badge && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200">
              {badge}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {copyText && open && <CopyBtn text={copyText} />}
          {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
        </div>
      </button>
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status toggle
// ---------------------------------------------------------------------------

const STATUS_STYLES = {
  PENDING:   "bg-slate-100 text-slate-600 border-slate-200",
  GENERATED: "bg-blue-50 text-blue-700 border-blue-200",
  PUBLISHED: "bg-green-50 text-green-700 border-green-200",
};

type BriefStatus = "PENDING" | "GENERATED" | "PUBLISHED";

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

interface Props {
  brief: BriefRow;
  open: boolean;
  onClose: () => void;
  onStatusChange: (briefId: string, status: BriefStatus) => void;
}

export function BriefModal({ brief, open, onClose, onStatusChange }: Props) {
  const [statusUpdating, setStatusUpdating] = useState(false);
  const content = brief.briefContent;

  async function togglePublished() {
    const next: BriefStatus = brief.status === "PUBLISHED" ? "GENERATED" : "PUBLISHED";
    setStatusUpdating(true);
    try {
      await fetch(`/api/briefs/brief/${brief.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      onStatusChange(brief.id, next);
    } catch { /* silently fail */ }
    finally { setStatusUpdating(false); }
  }

  const faqText = content?.faqs
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
    .join("\n\n") ?? "";

  const fullBriefText = content ? [
    `# ${brief.topic}`,
    `\nPrompt: ${brief.promptText}`,
    `\n## Content Type\n${content.contentType}`,
    `\n## Direct Answer\n${content.directAnswer}`,
    `\n## Suggested H2 Headings\n${content.headings.map((h) => `- ${h}`).join("\n")}`,
    `\n## FAQ Section\n${faqText}`,
    `\n## Target Word Count\n${content.targetWordCount} words`,
    `\n## Keywords\n${content.keywords.join(", ")}`,
    `\n## E-E-A-T Recommendations\n${content.eeatRecommendations.map((r) => `- ${r}`).join("\n")}`,
    `\n## Internal Linking\n${content.internalLinkingSuggestions.map((l) => `- ${l}`).join("\n")}`,
    `\n## Competitor Gaps\n${content.competitorGaps.map((g) => `- ${g}`).join("\n")}`,
  ].join("") : "";

  const schemaText = brief.schemaMarkup
    ? `<script type="application/ld+json">\n${brief.schemaMarkup}\n</script>`
    : null;

  const validateUrl = brief.schemaMarkup
    ? `https://search.google.com/test/rich-results?url=&user_agent=1`
    : null;

  if (!content) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap pr-8">
            <BookOpen className="h-5 w-5 text-indigo-600 shrink-0" />
            <span className="text-slate-900 font-semibold leading-tight">{brief.topic}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Top bar: quality score, status, copy all */}
        <div className="flex items-center justify-between gap-3 flex-wrap py-2 border-b border-slate-100">
          {brief.qualityScore && <QualityRing score={brief.qualityScore.total} />}
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline" className={`text-xs ${STATUS_STYLES[brief.status]}`}>
              {brief.status.charAt(0) + brief.status.slice(1).toLowerCase()}
            </Badge>
            <Button size="sm" variant="outline"
              onClick={togglePublished} disabled={statusUpdating}
              className="h-8 text-xs border-slate-300 text-slate-600">
              {brief.status === "PUBLISHED" ? "Mark as Draft" : "Mark as Published"}
            </Button>
            <CopyBtn text={fullBriefText} label="Copy Full Brief" />
          </div>
        </div>

        <div className="space-y-3 pt-1">
          {/* Target prompt */}
          <Section icon={<Target className="h-4 w-4" />} title="Target Prompt" defaultOpen>
            <p className="text-sm text-slate-700 font-medium italic">"{brief.promptText}"</p>
          </Section>

          {/* Recommended content type */}
          <Section icon={<Layers className="h-4 w-4" />} title="Recommended Content Type">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-sm px-3 py-1">
                {content.contentType}
              </Badge>
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
                ~{content.targetWordCount.toLocaleString()} words
              </Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                Schema: {content.schemaType}
              </Badge>
            </div>
          </Section>

          {/* Direct answer */}
          <Section icon={<Zap className="h-4 w-4" />} title="Direct Answer" badge="Put at top of page"
            copyText={content.directAnswer}>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm text-amber-900 leading-relaxed font-medium">
                {content.directAnswer}
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {content.directAnswer.trim().split(/\s+/).length} words · Place this in the first paragraph, before any other content.
            </p>
          </Section>

          {/* H2 headings */}
          <Section icon={<AlignLeft className="h-4 w-4" />} title="Suggested H2 Headings"
            badge={`${content.headings.length} headings`}
            copyText={content.headings.map((h) => `## ${h}`).join("\n")}>
            <ol className="space-y-1.5">
              {content.headings.map((h, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700">{h}</span>
                </li>
              ))}
            </ol>
          </Section>

          {/* FAQ section */}
          <Section icon={<HelpCircle className="h-4 w-4" />} title="FAQ Section"
            badge={`${content.faqs.length} Q&As`}
            copyText={faqText}>
            <div className="space-y-3">
              {content.faqs.map((faq, i) => (
                <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800 mb-1">
                    <span className="text-indigo-500 mr-1">Q{i + 1}.</span>
                    {faq.question}
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Keywords */}
          <Section icon={<Hash className="h-4 w-4" />} title="Keywords to Include"
            badge={`${content.keywords.length} terms`}
            copyText={content.keywords.join(", ")}>
            <div className="flex flex-wrap gap-1.5">
              {content.keywords.map((kw) => (
                <span key={kw} className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                  {kw}
                </span>
              ))}
            </div>
          </Section>

          {/* E-E-A-T */}
          <Section icon={<Award className="h-4 w-4" />} title="E-E-A-T Recommendations"
            copyText={content.eeatRecommendations.map((r) => `• ${r}`).join("\n")}>
            <ul className="space-y-2">
              {content.eeatRecommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                  {rec}
                </li>
              ))}
            </ul>
          </Section>

          {/* Internal linking */}
          <Section icon={<Link2 className="h-4 w-4" />} title="Internal Linking Suggestions"
            copyText={content.internalLinkingSuggestions.map((l) => `• ${l}`).join("\n")}>
            <ul className="space-y-2">
              {content.internalLinkingSuggestions.map((sug, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <Link2 className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  {sug}
                </li>
              ))}
            </ul>
          </Section>

          {/* Competitor gaps */}
          {content.competitorGaps.length > 0 && (
            <Section icon={<List className="h-4 w-4" />} title="Competitor Content Gaps"
              badge="Cover these too"
              copyText={content.competitorGaps.map((g) => `• ${g}`).join("\n")}>
              <ul className="space-y-2">
                {content.competitorGaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                    {gap}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Schema markup */}
          {schemaText && (
            <Section icon={<Code2 className="h-4 w-4" />} title="FAQPage Schema Markup"
              badge="Ready to paste" defaultOpen={false}>
              <div className="relative">
                <pre className="overflow-x-auto p-3 text-[11px] font-mono text-green-400 bg-slate-950 rounded-lg max-h-64">
                  {schemaText}
                </pre>
                <div className="flex items-center gap-2 mt-2">
                  <CopyBtn text={schemaText} label="Copy Schema" />
                  {validateUrl && (
                    <a
                      href="https://search.google.com/test/rich-results"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Validate on Google
                    </a>
                  )}
                </div>
              </div>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
