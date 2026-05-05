"use client";

import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, FileText, Zap } from "lucide-react";
import type { BriefRow } from "@/lib/brief-types";

const STATUS_STYLE = {
  PENDING:   "bg-slate-100 text-slate-500 border-slate-200",
  GENERATED: "bg-blue-50 text-blue-700 border-blue-200",
  PUBLISHED: "bg-green-50 text-green-700 border-green-200",
};

const STATUS_LABEL = {
  PENDING: "Pending", GENERATED: "Draft", PUBLISHED: "Published",
};

function QualityPill({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-50 text-green-700" : score >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      <Zap className="h-2.5 w-2.5" />
      {score}
    </span>
  );
}

interface Props {
  brief: BriefRow;
  onClick: () => void;
}

export function BriefCard({ brief, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm transition-all p-4 space-y-3 group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <BookOpen className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {brief.qualityScore && <QualityPill score={brief.qualityScore.total} />}
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_STYLE[brief.status]}`}>
            {STATUS_LABEL[brief.status]}
          </Badge>
        </div>
      </div>

      {/* Title */}
      <div>
        <p className="text-sm font-semibold text-slate-800 leading-snug group-hover:text-indigo-700 transition-colors line-clamp-2">
          {brief.topic}
        </p>
        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">
          "{brief.promptText}"
        </p>
      </div>

      {/* Footer meta */}
      <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
        {brief.wordCountEstimate && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <FileText className="h-3 w-3" />
            {brief.wordCountEstimate.toLocaleString()} words
          </div>
        )}
        <div className="flex items-center gap-1 text-[11px] text-slate-400 ml-auto">
          <Clock className="h-3 w-3" />
          {new Date(brief.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      </div>
    </button>
  );
}
