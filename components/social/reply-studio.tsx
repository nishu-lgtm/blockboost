"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { X, ExternalLink, RotateCcw, Copy, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { checkReplyQuality } from "@/lib/reply-generator";
import type { QualityCheck, ReplyVariant } from "@/lib/reply-generator";
import type { SocialPlatform } from "@prisma/client";

interface Opportunity {
  id: string;
  platform: SocialPlatform;
  url: string;
  title: string;
  body: string;
  author: string;
  subreddit?: string | null;
  upvotes: number;
  commentCount: number;
}

interface Props {
  opportunity: Opportunity;
  projectId: string;
  brandName: string;
  city: string;
  onClose: () => void;
  onPosted: (oppId: string) => void;
}

const TONES = ["HELPFUL", "PROFESSIONAL", "CASUAL"] as const;
type Tone = (typeof TONES)[number];
const TONE_LABELS: Record<Tone, string> = {
  HELPFUL: "Helpful",
  PROFESSIONAL: "Professional",
  CASUAL: "Casual",
};

function QualityBadge({ status }: { status: QualityCheck["status"] }) {
  if (status === "pass") return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
}

export default function ReplyStudio({ opportunity, projectId, brandName, city, onClose, onPosted }: Props) {
  const [activeTone, setActiveTone] = useState<Tone>("HELPFUL");
  const [variants, setVariants] = useState<Record<Tone, ReplyVariant | null>>({
    HELPFUL: null,
    PROFESSIONAL: null,
    CASUAL: null,
  });
  const [editedText, setEditedText] = useState<Record<Tone, string>>({
    HELPFUL: "",
    PROFESSIONAL: "",
    CASUAL: "",
  });
  const [generating, setGenerating] = useState(false);
  const [showMarkPosted, setShowMarkPosted] = useState(false);
  const [postUrl, setPostUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [postedReplyId, setPostedReplyId] = useState<string | null>(null);

  const currentText = editedText[activeTone];
  const quality = checkReplyQuality(currentText, opportunity.platform, brandName, city);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/social/replies?action=generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: opportunity.id }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data = (await res.json()) as { variants: ReplyVariant[] };

      const newVariants: Record<Tone, ReplyVariant | null> = {
        HELPFUL: null, PROFESSIONAL: null, CASUAL: null,
      };
      const newEdited: Record<Tone, string> = {
        HELPFUL: "", PROFESSIONAL: "", CASUAL: "",
      };

      for (const v of data.variants) {
        newVariants[v.tone as Tone] = v;
        newEdited[v.tone as Tone] = v.text;
      }

      setVariants(newVariants);
      setEditedText(newEdited);
    } catch {
      toast.error("Failed to generate replies. Check your OpenAI API key.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    const text = editedText[activeTone];
    if (!text) return;
    await fetch("/api/social/replies?action=save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opportunityId: opportunity.id,
        draftText: text,
        tone: activeTone,
        approved: false,
      }),
    });
  }

  async function markPosted() {
    setPosting(true);
    try {
      await saveDraft();
      const saveRes = await fetch("/api/social/replies?action=save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          draftText: editedText[activeTone],
          finalText: editedText[activeTone],
          tone: activeTone,
          approved: true,
        }),
      });
      const savedReply = (await saveRes.json()) as { id: string };

      await fetch("/api/social/replies?action=mark-posted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyId: savedReply.id,
          postUrl: postUrl || undefined,
        }),
      });

      toast.success("Reply marked as posted! We'll track if this thread gets cited by AI.");
      setPostedReplyId(savedReply.id);
      setShowMarkPosted(false);
      onPosted(opportunity.id);
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  // Auto-generate on mount
  useEffect(() => {
    generate();
  }, []);

  const platformLimit = opportunity.platform === "REDDIT" ? 150
    : opportunity.platform === "QUORA" ? 300 : 200;
  const wordCount = currentText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Reply Studio</h2>
            <p className="text-xs text-slate-500 mt-0.5">Lead with value, mention your business naturally</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Body — split panel */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left — original post */}
          <div className="w-1/2 border-r border-slate-100 overflow-y-auto p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                opportunity.platform === "REDDIT" ? "bg-orange-100 text-orange-700"
                : opportunity.platform === "QUORA" ? "bg-red-100 text-red-700"
                : "bg-blue-100 text-blue-700"
              }`}>
                {opportunity.platform}
              </span>
              {opportunity.subreddit && (
                <span className="text-xs text-slate-500">r/{opportunity.subreddit}</span>
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 leading-tight mb-3">
              {opportunity.title}
            </h3>

            {opportunity.body && (
              <div className="text-sm text-slate-600 leading-relaxed mb-4 whitespace-pre-wrap">
                {opportunity.body.slice(0, 1500)}
                {opportunity.body.length > 1500 && "…"}
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
              <span>👍 {opportunity.upvotes}</span>
              <span>💬 {opportunity.commentCount}</span>
              <span>by {opportunity.author}</span>
            </div>

            <a
              href={opportunity.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              Open original post
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Right — reply drafts */}
          <div className="w-1/2 flex flex-col overflow-hidden p-6">
            {/* Tone tabs */}
            <div className="flex items-center gap-1 mb-4 bg-slate-100 rounded-lg p-1">
              {TONES.map((tone) => (
                <button
                  key={tone}
                  onClick={() => setActiveTone(tone)}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all ${
                    activeTone === tone
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {TONE_LABELS[tone]}
                </button>
              ))}
            </div>

            {/* Draft text area */}
            <div className="flex-1 flex flex-col min-h-0">
              {generating ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" />
                    <p className="text-sm text-slate-500">Generating AI-crafted replies…</p>
                  </div>
                </div>
              ) : (
                <textarea
                  value={currentText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditedText((prev) => ({ ...prev, [activeTone]: val }));
                  }}
                  className="flex-1 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent min-h-0"
                  placeholder="Your reply will appear here after generation…"
                />
              )}

              {/* Word count */}
              {!generating && (
                <div className={`text-xs mt-1 text-right ${
                  wordCount > platformLimit ? "text-red-500 font-semibold" : "text-slate-400"
                }`}>
                  {wordCount}/{platformLimit} words
                </div>
              )}
            </div>

            {/* Quality checklist */}
            {!generating && currentText && (
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Quality check
                </p>
                {quality.map((check) => (
                  <div key={check.id} className="flex items-center gap-2">
                    <QualityBadge status={check.status} />
                    <span className="text-xs text-slate-600">{check.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={generate}
                disabled={generating}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(currentText);
                  toast.success("Copied to clipboard");
                }}
                disabled={!currentText}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
              {!postedReplyId && (
                <Button
                  size="sm"
                  className="ml-auto bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
                  onClick={() => setShowMarkPosted(true)}
                  disabled={!currentText || generating}
                >
                  Mark as posted
                </Button>
              )}
              {postedReplyId && (
                <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                  <CheckCircle className="h-4 w-4" />
                  Posted — tracking AI citations
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mark as posted modal */}
      {showMarkPosted && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl border p-6 w-full max-w-sm mx-4 z-10">
            <h3 className="font-bold text-slate-900 mb-1">Did you post this reply?</h3>
            <p className="text-sm text-slate-500 mb-4">
              We&apos;ll track upvotes and monitor if this thread gets cited by AI platforms.
            </p>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Paste the URL to your reply (optional)
            </label>
            <input
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://reddit.com/r/..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-sm" onClick={() => setShowMarkPosted(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold"
                onClick={markPosted}
                disabled={posting}
              >
                {posting ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
