import { Suspense } from "react";
import Topbar from "@/components/dashboard/topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield, CreditCard, Plug, Mail } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { BillingTab } from "@/components/settings/billing-tab";
import EmailPreferencesTab from "@/components/settings/email-preferences-tab";
import { ProfileTab } from "@/components/settings/profile-tab";
import { SecurityTab } from "@/components/settings/security-tab";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; gsc?: string; slack?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const defaultTab = params.tab ?? "profile";

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

    // Fetch period end from Stripe if available
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && user?.stripeSubscriptionId) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey);
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        periodEndDate = new Date(sub.current_period_end * 1000).toISOString();
      } catch {
        // ignore — Stripe may not be configured in dev
      }
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Settings" description="Manage your account and preferences" />
      <main className="flex-1 p-6">
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="profile" className="gap-2 text-sm">
              <User className="h-3.5 w-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 text-sm">
              <Bell className="h-3.5 w-3.5" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2 text-sm">
              <CreditCard className="h-3.5 w-3.5" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 text-sm">
              <Shield className="h-3.5 w-3.5" />
              Security
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2 text-sm">
              <Plug className="h-3.5 w-3.5" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="emails" className="gap-2 text-sm">
              <Mail className="h-3.5 w-3.5" />
              Emails
            </TabsTrigger>
          </TabsList>

          {/* Profile */}
          <TabsContent value="profile">
            <ProfileTab
              initialName={session?.user?.name ?? ""}
              initialEmail={session?.user?.email ?? ""}
            />
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Suspense fallback={<div className="h-40 animate-pulse bg-slate-100 rounded-xl" />}>
              <NotificationsTab
                initialEmailNotifications={emailNotifications}
                initialSlackConnected={slackConnected}
              />
            </Suspense>
          </TabsContent>

          {/* Billing — uses client component for cancellation modal */}
          <TabsContent value="billing">
            <BillingTab
              plan={plan}
              stripeSubscriptionId={stripeSubscriptionId}
              periodEndDate={periodEndDate}
              isPaused={isPaused}
              pauseUntil={pauseUntil}
            />
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations">
            <IntegrationsTab gscConnected={gscConnected} gscProperty={gscProperty} />
          </TabsContent>

          {/* Email preferences */}
          <TabsContent value="emails">
            <EmailPreferencesTab initialPrefs={emailPrefs} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
