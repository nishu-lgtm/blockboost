"use client";

import { formatDistanceToNow } from "date-fns";
import { ExternalLink, MessageSquare, ThumbsUp, Eye, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Opportunity {
  id: string;
  platform: "REDDIT" | "QUORA" | "LINKEDIN";
  url: string;
  title: string;
  body: string;
  author: string;
  subreddit?: string | null;
  upvotes: number;
  commentCount: number;
  aiCitationProbability: number;
  relevanceScore: number;
  status: string;
  foundAt: string;
  replies: Array<{ id: string; tone: string; approved: boolean; postedAt: string | null; aiCited: boolean }>;
}

interface Props {
  opportunity: Opportunity;
  onDraftReply: (id: string) => void;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
}

const PLATFORM_CONFIG = {
  REDDIT: { label: "Reddit", color: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  QUORA: { label: "Quora", color: "bg-red-100 text-red-700", dot: "bg-red-500" },
  LINKEDIN: { label: "LinkedIn", color: "bg-blue-100 text-blue-700", dot: "bg-blue-600" },
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-amber-500" : score >= 50 ? "bg-amber-400" : "bg-slate-300";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-bold text-slate-800 w-12 text-right">{score}/100</span>
    </div>
  );
}

export default function OpportunityCard({ opportunity: opp, onDraftReply, onDismiss, onSnooze }: Props) {
  const platform = PLATFORM_CONFIG[opp.platform];
  const hasPostedReply = opp.replies.some((r) => r.postedAt);
  const hasDraft = opp.replies.length > 0;
  const isCited = opp.replies.some((r) => r.aiCited);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-amber-200 hover:shadow-sm transition-all">
      {/* Top row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${platform.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${platform.dot}`} />
            {platform.label}
          </span>
          {opp.subreddit && (
            <span className="text-xs text-slate-500 font-medium">r/{opp.subreddit}</span>
          )}
          {opp.status === "NEW" && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              NEW
            </span>
          )}
          {hasPostedReply && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
              {isCited ? "✓ AI Cited" : "Replied"}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(opp.foundAt), { addSuffix: true })}
        </span>
      </div>

      {/* Title */}
      <a
        href={opp.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-2 mb-2"
      >
        <h3 className="font-semibold text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-2 leading-snug">
          {opp.title}
        </h3>
        <ExternalLink className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>

      {/* Body preview */}
      {opp.body && (
        <p className="text-sm text-slate-500 line-clamp-2 mb-3 leading-relaxed">
          {opp.body}
        </p>
      )}

      {/* Metrics */}
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5" />
          {opp.upvotes.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          {opp.commentCount}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          Est. {Math.round(opp.upvotes * 12).toLocaleString()} views
        </span>
      </div>

      {/* AI Citation Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-600">AI citation probability</span>
          <button
            title={`High-traffic ${opp.platform} posts are frequently cited by Perplexity and ChatGPT for local searches`}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            ⓘ
          </button>
        </div>
        <ScoreBar score={opp.aiCitationProbability} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {!hasPostedReply && (
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
            onClick={() => onDraftReply(opp.id)}
          >
            {hasDraft ? "Edit draft" : "Draft reply"}
          </Button>
        )}
        <a
          href={opp.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          View post ↗
        </a>
        {!hasPostedReply && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-slate-500"
              onClick={() => onSnooze(opp.id)}
            >
              Snooze 7d
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-slate-400 hover:text-red-500"
              onClick={() => onDismiss(opp.id)}
            >
              Dismiss
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
