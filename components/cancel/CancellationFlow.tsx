"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, Calendar, Loader2 } from "lucide-react";

/* ── Types ──────────────────────────────────────────────────── */

type Reason = {
  id: string;
  emoji: string;
  label: string;
};

const REASONS: Reason[] = [
  { id: "too_expensive",     emoji: "💸", label: "It's too expensive for my budget" },
  { id: "missing_feature",   emoji: "🔧", label: "It's missing a feature I need" },
  { id: "not_enough_value",  emoji: "📉", label: "I'm not seeing enough value yet" },
  { id: "found_alternative", emoji: "🏆", label: "I found a better alternative" },
  { id: "taking_a_break",    emoji: "⏸️",  label: "I'm just taking a break / seasonal business" },
  { id: "closing_business",  emoji: "🏢", label: "I'm closing or changing my business" },
  { id: "too_complicated",   emoji: "😕", label: "It was too complicated to use" },
  { id: "other",             emoji: "💬", label: "Other" },
];

const COMPETITORS = [
  "Otterly.ai",
  "Brandwatch",
  "SEMrush",
  "Moz",
  "Ahrefs",
  "BrightEdge",
  "Conductor",
  "Mention",
  "Other",
];

type Step = "survey" | "offer" | "final";
type OfferType = "discount" | "feature_request" | "onboarding_call" | "competitor_intel" | "pause" | "export_data" | "simple";

/* ── Component ───────────────────────────────────────────────── */

interface Props {
  onClose: () => void;
  onCancelled: (periodEnd: string) => void;
  userPlan: string;
  periodEndDate?: string; // existing period end from Stripe, e.g. "June 1, 2026"
  calendlyUrl?: string;   // optional Calendly link for onboarding call offer
}

export function CancellationFlow({ onClose, onCancelled, userPlan, periodEndDate, calendlyUrl }: Props) {
  const [step, setStep] = useState<Step>("survey");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [offerType, setOfferType] = useState<OfferType | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null); // shown when offer accepted

  // Pause offer
  const [pauseMonths, setPauseMonths] = useState(1);

  // Feature request offer
  const [featureText, setFeatureText] = useState("");

  // Competitor offer
  const [competitorSelected, setCompetitorSelected] = useState("");
  const [competitorFeedback, setCompetitorFeedback] = useState("");

  // Final step
  const [wantNotified, setWantNotified] = useState(false);
  const [wantWinback, setWantWinback] = useState(false);
  const [confirmedPeriodEnd, setConfirmedPeriodEnd] = useState(periodEndDate ?? "");
  const [confirming, setConfirming] = useState(false);

  // Prevent scroll on body while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  /* ── Step 1: Submit survey ───────────────────────────────── */

  async function submitSurvey() {
    if (!selectedReason) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cancel/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: selectedReason,
          otherText: selectedReason === "other" ? otherText : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOfferType(data.offerType as OfferType);
        setRecordId(data.recordId);
        setStep("offer");
      }
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 2: Accept an offer ─────────────────────────────── */

  async function acceptOffer(type: string, extra: Record<string, unknown> = {}) {
    if (!recordId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cancel/accept-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, offerType: type, ...extra }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.proceed === "cancel") {
          // Competitor intel — proceed straight to final
          setStep("final");
        } else {
          setSavedMsg(data.message ?? "Offer applied! We're glad you're staying.");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 3: Final confirm ────────────────────────────────── */

  async function confirmCancel() {
    if (!recordId) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/cancel/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, wantNotified, wantWinback }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmedPeriodEnd(data.periodEnd ? new Date(data.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : confirmedPeriodEnd);
        onCancelled(data.periodEnd ?? "");
      }
    } finally {
      setConfirming(false);
    }
  }

  /* ── Offer accepted state ────────────────────────────────── */
  if (savedMsg) {
    return (
      <Overlay>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{savedMsg}</h2>
          <p className="text-gray-500 text-sm mb-6">No action needed — we've taken care of everything on our end.</p>
          <button
            onClick={onClose}
            className="w-full bg-amber-500 hover:bg-amber-400 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Back to my account
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div className="relative max-w-xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100 flex-shrink-0">
          <div
            className="h-1 bg-amber-400 transition-all duration-500"
            style={{ width: step === "survey" ? "33%" : step === "offer" ? "66%" : "100%" }}
          />
        </div>

        <div className="overflow-y-auto flex-1 p-8">

          {/* ── STEP 1: Exit Survey ─────────────────────────── */}
          {step === "survey" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Before you go — can you tell us why?</h2>
                <p className="text-gray-500 text-sm mt-1">This takes 30 seconds and genuinely helps us improve.</p>
              </div>

              <div className="space-y-2">
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReason(r.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                      selectedReason === r.id
                        ? "border-amber-400 bg-amber-50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-xl leading-none flex-shrink-0">{r.emoji}</span>
                    <span className={`text-sm font-medium ${selectedReason === r.id ? "text-amber-900" : "text-gray-700"}`}>
                      {r.label}
                    </span>
                    {selectedReason === r.id && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-amber-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {selectedReason === "other" && (
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="Tell us more…"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                />
              )}

              <button
                onClick={submitSurvey}
                disabled={!selectedReason || loading || (selectedReason === "other" && !otherText)}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Saving…" : "Continue"}
                {!loading && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* ── STEP 2: Personalised Offer ─────────────────── */}
          {step === "offer" && offerType && (
            <OfferStep
              offerType={offerType}
              loading={loading}
              pauseMonths={pauseMonths}
              setPauseMonths={setPauseMonths}
              featureText={featureText}
              setFeatureText={setFeatureText}
              competitorSelected={competitorSelected}
              setCompetitorSelected={setCompetitorSelected}
              competitorFeedback={competitorFeedback}
              setCompetitorFeedback={setCompetitorFeedback}
              calendlyUrl={calendlyUrl}
              onAccept={acceptOffer}
              onDecline={() => setStep("final")}
              recordId={recordId ?? ""}
            />
          )}

          {/* ── STEP 3: Final Confirmation ─────────────────── */}
          {step === "final" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">One last thing</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Your subscription will end on <strong>{confirmedPeriodEnd || "your next billing date"}</strong>. You have full access until then.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wantNotified}
                    onChange={(e) => setWantNotified(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm text-gray-600">
                    Email me if BlockBoost ships {selectedReason === "missing_feature" ? "the feature I need" : "major improvements"}
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wantWinback}
                    onChange={(e) => setWantWinback(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm text-gray-600">
                    I might come back — remind me in 3 months with a discount
                  </span>
                </label>
              </div>

              <div className="space-y-3">
                <button
                  onClick={confirmCancel}
                  disabled={confirming}
                  className="w-full flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
                >
                  {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {confirming ? "Cancelling…" : "Confirm cancellation"}
                </button>
                <button
                  onClick={onClose}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
                >
                  Wait, I changed my mind — keep my subscription
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/* ── Overlay ─────────────────────────────────────────────────── */
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
    >
      {children}
    </div>
  );
}

/* ── Offer Step ───────────────────────────────────────────────── */
interface OfferStepProps {
  offerType: OfferType;
  loading: boolean;
  pauseMonths: number;
  setPauseMonths: (n: number) => void;
  featureText: string;
  setFeatureText: (s: string) => void;
  competitorSelected: string;
  setCompetitorSelected: (s: string) => void;
  competitorFeedback: string;
  setCompetitorFeedback: (s: string) => void;
  calendlyUrl?: string;
  onAccept: (type: string, extra?: Record<string, unknown>) => void;
  onDecline: () => void;
  recordId: string;
}

function OfferStep({
  offerType, loading,
  pauseMonths, setPauseMonths,
  featureText, setFeatureText,
  competitorSelected, setCompetitorSelected,
  competitorFeedback, setCompetitorFeedback,
  calendlyUrl,
  onAccept, onDecline,
}: OfferStepProps) {

  switch (offerType) {

    /* 💸 Too expensive → 50% off */
    case "discount":
      return (
        <div className="space-y-6">
          <OfferCard
            emoji="💛"
            headline="How about 50% off for 2 months?"
            body="We'd rather keep you at half price than lose you. No strings attached — full access to everything."
          />
          <div className="space-y-3">
            <button
              onClick={() => onAccept("discount")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors text-base"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "💛"}
              {loading ? "Applying…" : "Yes, give me 50% off"}
            </button>
            <DeclineButton onClick={onDecline} />
          </div>
        </div>
      );

    /* 🔧 Missing feature → free month + feedback */
    case "feature_request":
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">We're building fast — want to see it ship?</h2>
            <p className="text-gray-500 text-sm mt-1">Tell us what you need. If it's on our roadmap we'll email you the day it launches.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What feature would make BlockBoost perfect for you? <span className="text-red-400">*</span></label>
            <textarea
              value={featureText}
              onChange={(e) => setFeatureText(e.target.value)}
              placeholder="E.g. Competitor comparison reports, TikTok tracking, API access…"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
            />
          </div>
          <div className="space-y-3">
            <button
              onClick={() => onAccept("free_month", { featureRequested: featureText })}
              disabled={loading || !featureText.trim()}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "🎁"}
              {loading ? "Applying…" : "Submit feedback + stay for 1 month free"}
            </button>
            <DeclineButton onClick={onDecline} />
          </div>
        </div>
      );

    /* 📉 Not seeing value → onboarding call */
    case "onboarding_call":
      return (
        <div className="space-y-6">
          <OfferCard
            emoji="📞"
            headline="Let us show you what you might be missing"
            body="Book a free 30-minute call with our team. We'll set everything up and show you exactly how to get results."
          />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-900 mb-1">Or pause instead?</p>
            <p className="text-xs text-amber-700">Not ready to book a call? Put your account on pause for up to 3 months — your data stays safe.</p>
            <button
              onClick={() => onAccept("pause", { pauseMonths: 1 })}
              className="mt-2 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Pause for 1 month instead →
            </button>
          </div>
          <div className="space-y-3">
            <a
              href={calendlyUrl ?? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/contact`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold py-3.5 rounded-xl transition-colors text-base"
              onClick={() => onAccept("onboarding_call")}
            >
              <Calendar className="w-4 h-4" />
              Book free call
            </a>
            <DeclineButton onClick={onDecline} />
          </div>
        </div>
      );

    /* 🏆 Found alternative → competitor intel */
    case "competitor_intel":
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Mind if we ask which one?</h2>
            <p className="text-gray-500 text-sm mt-1">We won't try to talk you out of it — we just want to learn.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Which tool are you switching to?</label>
            <select
              value={competitorSelected}
              onChange={(e) => setCompetitorSelected(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="">Select a tool…</option>
              {COMPETITORS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What did they offer that we didn't? <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={competitorFeedback}
              onChange={(e) => setCompetitorFeedback(e.target.value)}
              placeholder="Any feedback helps us improve…"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
            />
          </div>
          <button
            onClick={() => onAccept("competitor_intel", { competitorNamed: competitorSelected, competitorFeedback })}
            disabled={loading || !competitorSelected}
            className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Submitting…" : "Submit and continue cancelling"}
          </button>
        </div>
      );

    /* ⏸️ Taking a break → pause */
    case "pause":
      return (
        <div className="space-y-6">
          <OfferCard
            emoji="⏸️"
            headline="Pause instead of cancel?"
            body="Put your account on pause for 1–3 months. Your data stays safe, your settings are preserved, and you can resume anytime."
          />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">How long do you need?</p>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((m) => (
                <button
                  key={m}
                  onClick={() => setPauseMonths(m)}
                  className={`py-3 rounded-xl border font-semibold text-sm transition-all ${
                    pauseMonths === m
                      ? "border-amber-400 bg-amber-50 text-amber-900"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {m} {m === 1 ? "month" : "months"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => onAccept("pause", { pauseMonths })}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors text-base"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "⏸️"}
              {loading ? "Pausing…" : `Pause my account for ${pauseMonths} ${pauseMonths === 1 ? "month" : "months"}`}
            </button>
            <DeclineButton onClick={onDecline} />
          </div>
        </div>
      );

    /* 🏢 Closing / 😕 Too complicated → export data */
    case "export_data":
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">We're sorry to see you go</h2>
            <p className="text-gray-500 text-sm mt-1">Before you cancel, would you like us to export all your visibility data as a PDF report?</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => {
                // Trigger a report generation then proceed to cancel
                void fetch("/api/reports/generate", { method: "POST" });
                onDecline();
              }}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold py-3.5 rounded-xl transition-colors"
            >
              📄 Generate final report + continue cancelling
            </button>
            <DeclineButton onClick={onDecline} label="Just cancel" />
          </div>
        </div>
      );

    /* fallback */
    default:
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">We're sorry to see you go</h2>
            <p className="text-gray-500 text-sm mt-1">Ready to continue with cancellation?</p>
          </div>
          <button
            onClick={onDecline}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
          >
            Continue to cancellation
          </button>
        </div>
      );
  }
}

/* ── Sub-components ──────────────────────────────────────────── */

function OfferCard({ emoji, headline, body }: { emoji: string; headline: string; body: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
      <div className="text-4xl mb-3">{emoji}</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{headline}</h2>
      <p className="text-gray-600 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function DeclineButton({ onClick, label = "No thanks, continue cancelling" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
    >
      {label}
    </button>
  );
}
