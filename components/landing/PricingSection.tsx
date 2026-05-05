"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Link from "next/link";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    sub: "For one location",
    monthly: 79,
    annual: 63,
    cta: "Start free trial",
    highlight: false,
    features: [
      "3 AI platforms tracked",
      "50 prompts per month",
      "3 competitors",
      "AI visibility dashboard",
      "Basic reports",
      "Email alerts",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    sub: "For growing businesses",
    monthly: 299,
    annual: 239,
    cta: "Start free trial",
    highlight: true,
    badge: "Most Popular",
    features: [
      "6 AI platforms tracked",
      "500 prompts per month",
      "5 competitors",
      "Everything in Starter",
      "AI Assistant (copilot)",
      "Content briefs",
      "GSC integration",
      "Priority support",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    sub: "For agencies & consultants",
    monthly: 999,
    annual: 799,
    cta: "Start free trial",
    highlight: false,
    features: [
      "All platforms",
      "Unlimited prompts",
      "Unlimited clients",
      "White-label reports",
      "API access",
      "Dedicated support",
    ],
  },
];

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24 bg-[var(--bb-gray-50)]">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">
            PRICING
          </span>
          <h2 className="text-4xl font-bold text-gray-900 mt-3 mb-3">
            Simple pricing, no surprises
          </h2>
          <p className="text-lg text-gray-500">Start free. Upgrade when you&apos;re ready.</p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm font-semibold ${!annual ? "text-gray-900" : "text-gray-400"}`}>
              Monthly
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                annual ? "bg-amber-500" : "bg-gray-200"
              }`}
              aria-pressed={annual}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  annual ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${annual ? "text-gray-900" : "text-gray-400"}`}>
                Annual
              </span>
              <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-8 ${
                plan.highlight
                  ? "bg-amber-500 text-white shadow-xl shadow-amber-200"
                  : "bg-white border border-gray-200"
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-amber-600 text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-amber-100">
                  {plan.badge}
                </span>
              )}

              <p className={`font-bold text-lg mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                {plan.name}
              </p>
              <p className={`text-sm mb-6 ${plan.highlight ? "text-amber-100" : "text-gray-500"}`}>
                {plan.sub}
              </p>

              <div className="mb-8">
                <span className={`text-5xl font-extrabold ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                  ${annual ? plan.annual : plan.monthly}
                </span>
                <span className={`text-sm ml-1 ${plan.highlight ? "text-amber-100" : "text-gray-500"}`}>
                  /mo
                </span>
                {annual && (
                  <p className={`text-xs mt-1 ${plan.highlight ? "text-amber-100" : "text-gray-400"}`}>
                    billed annually
                  </p>
                )}
              </div>

              <Link
                href="/auth/register"
                className={`w-full block text-center py-3 rounded-xl font-bold text-sm transition-colors mb-8 ${
                  plan.highlight
                    ? "bg-white text-amber-600 hover:bg-amber-50"
                    : "bg-amber-500 text-white hover:bg-amber-600"
                }`}
              >
                {plan.cta}
              </Link>

              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <Check
                      className={`w-4 h-4 shrink-0 ${plan.highlight ? "text-white" : "text-amber-500"}`}
                    />
                    <span
                      className={`text-sm ${plan.highlight ? "text-white" : "text-gray-600"}`}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <div className="text-center mt-10 space-y-2">
          <p className="text-gray-500 text-sm">
            All plans include a 14-day free trial. No credit card required.
          </p>
          <p className="text-gray-400 text-sm">
            Questions about pricing?{" "}
            <button className="text-amber-600 font-semibold hover:underline">
              Chat with us →
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
