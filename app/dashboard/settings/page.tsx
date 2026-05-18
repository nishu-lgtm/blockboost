/**
 * Settings — iOS-style stacked list (U9).
 *
 * Before: horizontal Tabs strip with 6 triggers; cramped on mobile, doesn't
 * match the "browse" mental model.
 *
 * After: when no ?tab=, show a vertical list of sections (one card per
 * section, chevron on the right). When ?tab= is set, render that section's
 * content full-width with a back link. URL stays the same so the back
 * button works.
 */
import { Suspense } from "react";
import Link from "next/link";
import Topbar from "@/components/dashboard/topbar";
import {
  User, Bell, Shield, CreditCard, Plug, Mail, ChevronRight, ChevronLeft,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { BillingTab } from "@/components/settings/billing-tab";
import EmailPreferencesTab from "@/components/settings/email-preferences-tab";
import { ProfileTab } from "@/components/settings/profile-tab";
import { SecurityTab } from "@/components/settings/security-tab";

const SECTIONS = [
  { key: "profile",       icon: User,       label: "Profile",       hint: "Name, email, password" },
  { key: "notifications", icon: Bell,       label: "Notifications", hint: "Email digests and Slack" },
  { key: "billing",       icon: CreditCard, label: "Billing",       hint: "Plan, invoices, payment" },
  { key: "security",      icon: Shield,     label: "Security",      hint: "Sessions and 2FA" },
  { key: "integrations",  icon: Plug,       label: "Integrations",  hint: "GSC and Slack" },
  { key: "emails",        icon: Mail,       label: "Emails",        hint: "Which emails you receive" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; gsc?: string; slack?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const active = (SECTIONS.find((s) => s.key === params.tab)?.key ?? null) as
    | SectionKey
    | null;

  let gscConnected = false;
  let gscProperty: string | null = null;
  let emailNotifications = true;
  let slackConnected = false;
  let plan = "FREE";
  let stripeSubscriptionId: string | null = null;
  let periodEndDate: string | null = null;
  let isPaused = false;
  let pauseUntil: string | null = null;
  let emailPrefs = {
    emailPrefWeeklyReport: true,
    emailPrefMonthlySummary: true,
    emailPrefFeatureNews: true,
    emailPrefAlerts: true,
    emailPrefTips: true,
  };

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        gscConnected: true,
        gscProperty: true,
        emailNotifications: true,
        slackConnected: true,
        plan: true,
        stripeSubscriptionId: true,
        pausedAt: true,
        pauseUntil: true,
        emailPrefWeeklyReport: true,
        emailPrefMonthlySummary: true,
        emailPrefFeatureNews: true,
        emailPrefAlerts: true,
        emailPrefTips: true,
      },
    });
    gscConnected = user?.gscConnected ?? false;
    gscProperty = user?.gscProperty ?? null;
    emailNotifications = user?.emailNotifications ?? true;
    slackConnected = user?.slackConnected ?? false;
    plan = user?.plan ?? "FREE";
    stripeSubscriptionId = user?.stripeSubscriptionId ?? null;
    isPaused = !!user?.pausedAt;
    pauseUntil = user?.pauseUntil?.toISOString() ?? null;
    emailPrefs = {
      emailPrefWeeklyReport: user?.emailPrefWeeklyReport ?? true,
      emailPrefMonthlySummary: user?.emailPrefMonthlySummary ?? true,
      emailPrefFeatureNews: user?.emailPrefFeatureNews ?? true,
      emailPrefAlerts: user?.emailPrefAlerts ?? true,
      emailPrefTips: user?.emailPrefTips ?? true,
    };

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && user?.stripeSubscriptionId) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey);
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        periodEndDate = new Date(sub.current_period_end * 1000).toISOString();
      } catch {
        /* Stripe optional in dev */
      }
    }
  }

  // ── List view ──────────────────────────────────────────────────────────
  if (!active) {
    return (
      <div className="flex flex-col flex-1">
        <Topbar title="Settings" description="Manage your account and preferences" />
        <main className="flex-1 p-4 md:p-6 max-w-2xl w-full mx-auto">
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
            {SECTIONS.map((s) => (
              <Link
                key={s.key}
                href={`/dashboard/settings?tab=${s.key}`}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <s.icon className="h-4 w-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                  <p className="text-xs text-slate-500">{s.hint}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
              </Link>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ── Section view ───────────────────────────────────────────────────────
  const activeSection = SECTIONS.find((s) => s.key === active)!;

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Settings" description="Manage your account and preferences" />
      <main className="flex-1 p-4 md:p-6 max-w-3xl w-full mx-auto">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Settings
        </Link>
        <h2 className="text-xl font-semibold text-slate-900 mb-5">{activeSection.label}</h2>

        {active === "profile" && (
          <ProfileTab
            initialName={session?.user?.name ?? ""}
            initialEmail={session?.user?.email ?? ""}
          />
        )}

        {active === "notifications" && (
          <Suspense fallback={<div className="h-40 animate-pulse bg-slate-100 rounded-xl" />}>
            <NotificationsTab
              initialEmailNotifications={emailNotifications}
              initialSlackConnected={slackConnected}
            />
          </Suspense>
        )}

        {active === "billing" && (
          <BillingTab
            plan={plan}
            stripeSubscriptionId={stripeSubscriptionId}
            periodEndDate={periodEndDate}
            isPaused={isPaused}
            pauseUntil={pauseUntil}
          />
        )}

        {active === "security" && <SecurityTab />}

        {active === "integrations" && (
          <IntegrationsTab gscConnected={gscConnected} gscProperty={gscProperty} />
        )}

        {active === "emails" && <EmailPreferencesTab initialPrefs={emailPrefs} />}
      </main>
    </div>
  );
}
