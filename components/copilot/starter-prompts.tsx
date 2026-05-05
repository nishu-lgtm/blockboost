"use client";

import {
  TrendingDown, Sparkles, BarChart2, Link2, FileBarChart, Zap,
} from "lucide-react";

const SUGGESTIONS = [
  {
    icon: TrendingDown,
    text: "Why is my competitor outranking me on ChatGPT?",
    color: "text-red-500",
    bg: "bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300",
  },
  {
    icon: Sparkles,
    text: "Which prompts should I prioritize for content creation?",
    color: "text-indigo-500",
    bg: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 hover:border-indigo-300",
  },
  {
    icon: BarChart2,
    text: "What's causing my low mention rate on Perplexity?",
    color: "text-amber-500",
    bg: "bg-amber-50 hover:bg-amber-100 border-amber-200 hover:border-amber-300",
  },
  {
    icon: Link2,
    text: "Show me my biggest citation opportunities",
    color: "text-emerald-500",
    bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 hover:border-emerald-300",
  },
  {
    icon: FileBarChart,
    text: "Generate a weekly performance summary",
    color: "text-purple-500",
    bg: "bg-purple-50 hover:bg-purple-100 border-purple-200 hover:border-purple-300",
  },
  {
    icon: Zap,
    text: "What should I fix first to improve my AEO score?",
    color: "text-cyan-500",
    bg: "bg-cyan-50 hover:bg-cyan-100 border-cyan-200 hover:border-cyan-300",
  },
];

interface Props {
  onSelect: (text: string) => void;
}

export function StarterPrompts({ onSelect }: Props) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 gap-8">
      {/* Greeting */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-200">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">AI Visibility Copilot</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Ask me anything about your AEO performance. I have access to all your data and will give
          specific, actionable answers.
        </p>
      </div>

      {/* Suggestion chips */}
      <div className="w-full max-w-lg grid grid-cols-1 gap-2">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center mb-1">
          Try asking
        </p>
        {SUGGESTIONS.map(({ icon: Icon, text, color, bg }) => (
          <button
            key={text}
            onClick={() => onSelect(text)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm text-slate-700 font-medium transition-all ${bg}`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
