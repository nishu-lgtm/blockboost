"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "What exactly is AI visibility?",
    a: "When someone asks ChatGPT, Google AI, or Perplexity 'what's the best dentist in Austin?' — those tools give a direct answer. No scrolling through websites. Just a recommendation. AI visibility is whether your business gets mentioned in those answers. BlockBoost measures this for you.",
  },
  {
    q: "Do I need any technical knowledge?",
    a: "None at all. If you can use email, you can use BlockBoost. We handle everything — just tell us your business name and we do the rest.",
  },
  {
    q: "How is this different from regular SEO?",
    a: "Traditional SEO helps you rank in Google's blue links. AI visibility is about showing up in AI-generated answers — which is how more and more people search. BlockBoost focuses specifically on this new type of search that most businesses are completely ignoring.",
  },
  {
    q: "How long until I see results?",
    a: "Your first scan runs within minutes of signing up. You'll have your AI Visibility Score within 5 minutes. Improving your score typically takes 2–6 weeks depending on how quickly you implement our suggestions.",
  },
  {
    q: "Which AI platforms do you track?",
    a: "We currently track ChatGPT, Perplexity, and Google AI Overviews — the three platforms most relied on for local recommendations. Microsoft Copilot, Gemini, and others are on the roadmap.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, absolutely. No contracts, no cancellation fees. Cancel from your account settings in 30 seconds.",
  },
  {
    q: "Do you offer a free trial?",
    a: "Yes — 14 days free, no credit card required. You get full access to all features on the Growth plan during your trial.",
  },
  {
    q: "I'm an agency — can I manage multiple clients?",
    a: "Yes, our Agency plan is built for this. Manage unlimited clients, generate white-label reports with your brand, and access our API to integrate with your existing tools.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">FAQ</span>
          <h2 className="text-4xl font-bold text-gray-900 mt-3">
            Questions? We&apos;ve got answers.
          </h2>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900 text-base pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-amber-500 shrink-0 transition-transform duration-200 ${
                    open === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-5">
                  <p className="text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
