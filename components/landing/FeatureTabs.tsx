"use client";

import { useState } from "react";
import {
  BarChart3,
  Users,
  FileText,
  MessageSquare,
  Download,
} from "lucide-react";

const TABS = [
  {
    id: "visibility",
    label: "AI Visibility",
    icon: BarChart3,
    name: "AI Visibility Monitor",
    bullets: [
      "See your mention rate on ChatGPT, Gemini & Perplexity",
      "Know which questions you're answering — and which you're missing",
      "Track if you're improving week over week",
      "Get alerted the moment something changes",
    ],
    mockup: (
      <div className="space-y-3">
        {[
          { label: "ChatGPT", pct: 62, color: "bg-amber-500" },
          { label: "Perplexity", pct: 48, color: "bg-amber-400" },
          { label: "Gemini", pct: 31, color: "bg-amber-300" },
          { label: "Google AI", pct: 19, color: "bg-amber-200" },
        ].map((p) => (
          <div key={p.label} className="flex items-center gap-3">
            <span className="w-24 text-sm font-medium text-gray-600 shrink-0">{p.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2.5">
              <div className={`${p.color} h-2.5 rounded-full`} style={{ width: `${p.pct}%` }} />
            </div>
            <span className="text-sm font-bold text-gray-900 w-10 text-right">{p.pct}%</span>
          </div>
        ))}
        <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <p className="text-xs font-semibold text-amber-700">Overall mention rate</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">40%</p>
          <p className="text-xs text-green-600 font-semibold mt-1">↑ +12pp vs last month</p>
        </div>
      </div>
    ),
  },
  {
    id: "competitors",
    label: "Competitor Tracking",
    icon: Users,
    name: "Competitor Tracking",
    bullets: [
      "See exactly when AI recommends a competitor instead of you",
      "Track up to 5 competitors side by side",
      "Find the gaps where you're losing business to rivals",
      "Get notified when a competitor surges in AI mentions",
    ],
    mockup: (
      <div className="space-y-3">
        {[
          { name: "You", pct: 40, highlight: true },
          { name: "Rival A", pct: 65, highlight: false },
          { name: "Rival B", pct: 52, highlight: false },
          { name: "Rival C", pct: 28, highlight: false },
        ].map((c) => (
          <div
            key={c.name}
            className={`flex items-center gap-3 p-2 rounded-xl ${c.highlight ? "bg-amber-50 border border-amber-100" : ""}`}
          >
            <span className={`w-20 text-sm font-semibold shrink-0 ${c.highlight ? "text-amber-700" : "text-gray-600"}`}>
              {c.name}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-2.5">
              <div
                className={`${c.highlight ? "bg-amber-500" : "bg-gray-300"} h-2.5 rounded-full`}
                style={{ width: `${c.pct}%` }}
              />
            </div>
            <span className="text-sm font-bold text-gray-900 w-10 text-right">{c.pct}%</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "briefs",
    label: "Content Briefs",
    icon: FileText,
    name: "Content Briefs",
    bullets: [
      "Get ready-to-use content based on your gaps",
      "Hand it to any writer or paste it into your website",
      "Includes the exact words AI needs to recommend you",
      "No SEO knowledge required — it's all done for you",
    ],
    mockup: (
      <div className="space-y-3">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Content Brief</span>
            <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Ready</span>
          </div>
          <p className="text-sm font-bold text-gray-900 mb-2">"Best plumber in Austin"</p>
          <div className="space-y-1.5">
            {["Target word count: 800-1000 words", "Include: Emergency services, reviews", "Schema: LocalBusiness + Service"].map((s) => (
              <p key={s} className="text-xs text-gray-500">✓ {s}</p>
            ))}
          </div>
        </div>
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">3 briefs ready</p>
            <p className="text-xs text-gray-500">Based on your top gaps</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "assistant",
    label: "AI Assistant",
    icon: MessageSquare,
    name: "AI Assistant",
    bullets: [
      "Ask plain-English questions about your visibility",
      '"Why is my competitor showing up more than me?"',
      "Get a straight answer backed by your real data",
      "Available 24/7, like having an SEO expert on call",
    ],
    mockup: (
      <div className="space-y-3">
        <div className="flex gap-2.5">
          <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs">👤</span>
          </div>
          <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 max-w-xs">
            Why is Rival Plumbing showing up more than me on ChatGPT?
          </div>
        </div>
        <div className="flex gap-2.5 justify-end">
          <div className="bg-amber-500 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white max-w-xs">
            Rival Plumbing has 3× more content targeting emergency plumbing queries. Their Google Business profile also has 40+ more reviews. I recommend publishing a page targeting "24/7 emergency plumber Austin."
          </div>
          <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs">⚡</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "reports",
    label: "Reports",
    icon: Download,
    name: "Shareable Reports",
    bullets: [
      "One-click PDF report of your AI visibility",
      "Share with your team, partner, or marketing agency",
      "Month-over-month comparisons built in",
      "White-label option for agencies",
    ],
    mockup: (
      <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-amber-500 p-4">
          <p className="text-white text-xs font-semibold uppercase tracking-wider">AI Visibility Report</p>
          <p className="text-white text-lg font-bold mt-1">James T. Law Firm</p>
          <p className="text-amber-100 text-xs">April 2026</p>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { label: "Mention Rate", value: "34%" },
            { label: "Share of Voice", value: "28%" },
            { label: "Citations", value: "12" },
            { label: "Platforms", value: "5" },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-lg p-2 border border-gray-100">
              <p className="text-xs text-gray-400">{m.label}</p>
              <p className="text-lg font-bold text-gray-900">{m.value}</p>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 text-xs text-amber-800">
            ↑ Up 12pp from last month. Your top win: emergency plumbing queries.
          </div>
        </div>
      </div>
    ),
  },
];

export function FeatureTabs() {
  const [active, setActive] = useState("visibility");
  const tab = TABS.find((t) => t.id === active)!;

  return (
    <div className="space-y-8">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              active === t.id
                ? "bg-amber-500 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Left: description */}
        <div className="space-y-6">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
            <tab.icon className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{tab.name}</h3>
          <ul className="space-y-3">
            {tab.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-gray-600">
                <span className="text-amber-500 font-bold mt-0.5 shrink-0">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <a
            href="/auth/register"
            className="inline-flex items-center gap-2 text-amber-600 font-semibold hover:text-amber-700 transition-colors"
          >
            Try it free →
          </a>
        </div>

        {/* Right: mockup */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          {tab.mockup}
        </div>
      </div>
    </div>
  );
}
