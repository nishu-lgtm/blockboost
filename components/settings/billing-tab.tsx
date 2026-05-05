"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CancellationFlow } from "@/components/cancel/CancellationFlow";
import { CheckCircle, Pause } from "lucide-react";

interface BillingTabProps {
  plan: string;
  stripeSubscriptionId: string | null;
  periodEndDate: string | null;   // ISO string or null
  isPaused: boolean;
  pauseUntil: string | null;       // ISO string or null
}

const PLAN_LABELS: Record<string, { name: string; price: string; color: string }> = {
  FREE:       { name: "Free",       price: "$0/month",    color: "bg-gray-50 border-gray-200 text-gray-900" },
  STARTER:    { name: "Starter",    price: "$79/month",   color: "bg-blue-50 border-blue-200 text-blue-900" },
  GROWTH:     { name: "Growth",     price: "$299/month",  color: "bg-indigo-50 border-indigo-200 text-indigo-900" },
  ENTERPRISE: { name: "Enterprise", price: "$999/month",  color: "bg-amber-50 border-amber-200 text-amber-900" },
};

export function BillingTab({ plan, stripeSubscriptionId, periodEndDate, isPaused, pauseUntil }: BillingTabProps) {
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelPeriodEnd, setCancelPeriodEnd] = useState<string | null>(null);

  const planMeta = PLAN_LABELS[plan] ?? PLAN_LABELS.FREE;
  const isPaid = plan !== "FREE";

  const formattedPeriodEnd = periodEndDate
    ? new Date(periodEndDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const formattedPauseUntil = pauseUntil
    ? new Date(pauseUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  if (cancelled && cancelPeriodEnd) {
    const end = new Date(cancelPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return (
      <Card className="border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">Cancellation scheduled</p>
              <p className="text-sm text-green-700 mt-0.5">
                Your subscription will end on <strong>{end}</strong>. You have full access until then.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Current Plan</CardTitle>
          <CardDescription>Manage your subscription and billing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan card */}
          <div className={`flex items-center justify-between p-4 rounded-xl border ${planMeta.color}`}>
            <div>
              <p className="font-semibold">{planMeta.name} Plan</p>
              <p className="text-sm opacity-75 mt-0.5">
                {planMeta.price}
                {formattedPeriodEnd && !cancelled && ` · Renews ${formattedPeriodEnd}`}
              </p>
            </div>
            <Button variant="outline" size="sm" className="border-current opacity-60">
              Manage plan
            </Button>
          </div>

          {/* Paused banner */}
          {isPaused && formattedPauseUntil && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <Pause className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Subscription paused</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Your account is paused until {formattedPauseUntil}. It will resume automatically.
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* Payment method */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Payment method</p>
            <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
              <div className="w-10 h-6 bg-slate-800 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">VISA</span>
              </div>
              <span className="text-sm text-slate-600">•••• •••• •••• 4242</span>
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs text-indigo-600">
                Update
              </Button>
            </div>
          </div>

          {/* Billing history placeholder */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Recent invoices</p>
            <p className="text-sm text-slate-400">No invoices yet.</p>
          </div>

          {/* Cancel subscription — only for paid plans */}
          {isPaid && !isPaused && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Cancel subscription</p>
                <p className="text-xs text-slate-400 mb-3">
                  You can cancel at any time. Your access continues until the end of the current billing period.
                </p>
                <button
                  onClick={() => setShowCancellation(true)}
                  className="text-sm text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors"
                >
                  Cancel my subscription
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cancellation flow modal */}
      {showCancellation && (
        <CancellationFlow
          onClose={() => setShowCancellation(false)}
          onCancelled={(periodEnd) => {
            setShowCancellation(false);
            setCancelled(true);
            setCancelPeriodEnd(periodEnd);
          }}
          userPlan={plan}
          periodEndDate={periodEndDate ?? undefined}
          calendlyUrl={process.env.NEXT_PUBLIC_CALENDLY_URL}
        />
      )}
    </>
  );
}
