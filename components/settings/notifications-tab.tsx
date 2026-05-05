"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, MessageSquare, Mail, Bell } from "lucide-react";

interface NotificationPrefs {
  emailNotifications: boolean;
  slackConnected: boolean;
  slackWebhookUrl: string | null;
}

const NOTIFICATION_TYPES = [
  { key: "mention_rate_drop",    label: "Mention rate drop",   desc: "When your AI visibility drops more than 10%" },
  { key: "competitor_surge",     label: "Competitor surge",    desc: "When a competitor's mention rate spikes > 15%" },
  { key: "new_citation",         label: "New citation",        desc: "When a new domain starts citing your brand" },
  { key: "scan_complete",        label: "Scan complete",       desc: "Weekly visibility report emails" },
  { key: "hallucination",        label: "Hallucination detected", desc: "When AI fabricates inaccurate info about you" },
];

export function NotificationsTab({
  initialEmailNotifications,
  initialSlackConnected,
}: {
  initialEmailNotifications: boolean;
  initialSlackConnected: boolean;
}) {
  const searchParams = useSearchParams();
  const [emailEnabled, setEmailEnabled] = useState(initialEmailNotifications);
  const [slackConnected, setSlackConnected] = useState(initialSlackConnected);
  const [savingEmail, setSavingEmail] = useState(false);
  const [disconnectingSlack, setDisconnectingSlack] = useState(false);

  // Handle Slack OAuth callback param
  useEffect(() => {
    const slackParam = searchParams.get("slack");
    if (slackParam === "connected") {
      setSlackConnected(true);
      toast.success("Slack connected! You'll receive alerts in your channel.");
    } else if (slackParam === "error") {
      toast.error("Failed to connect Slack. Please try again.");
    }
  }, [searchParams]);

  async function toggleEmail(enabled: boolean) {
    setEmailEnabled(enabled);
    setSavingEmail(true);
    try {
      const res = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications: enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(enabled ? "Email notifications enabled" : "Email notifications disabled");
    } catch {
      setEmailEnabled(!enabled); // revert
      toast.error("Failed to save preference");
    } finally {
      setSavingEmail(false);
    }
  }

  async function disconnectSlack() {
    setDisconnectingSlack(true);
    try {
      const res = await fetch("/api/slack/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      setSlackConnected(false);
      toast.success("Slack disconnected");
    } catch {
      toast.error("Failed to disconnect Slack");
    } finally {
      setDisconnectingSlack(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Email notifications */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base">Email Notifications</CardTitle>
          </div>
          <CardDescription>
            Control which alerts are delivered to your inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Master toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-800">Enable email notifications</p>
              <p className="text-xs text-slate-400 mt-0.5">All alerts and weekly reports</p>
            </div>
            <button
              onClick={() => !savingEmail && toggleEmail(!emailEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors shrink-0 focus:outline-none ${
                emailEnabled ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              {savingEmail ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin text-white" />
                </span>
              ) : (
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    emailEnabled ? "left-5" : "left-0.5"
                  }`}
                />
              )}
            </button>
          </div>

          <Separator />

          {/* Individual types */}
          <div className="space-y-3 pl-1">
            {NOTIFICATION_TYPES.map((item) => (
              <div key={item.key} className="flex items-center justify-between py-1">
                <div>
                  <p className={`text-sm font-medium ${emailEnabled ? "text-slate-800" : "text-slate-400"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <div
                  className={`h-5 w-9 rounded-full relative shrink-0 ${
                    emailEnabled ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${emailEnabled ? "right-0.5" : "left-0.5"}`} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Slack integration */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base">Slack Alerts</CardTitle>
          </div>
          <CardDescription>
            Post real-time alerts to a Slack channel when visibility events occur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {slackConnected ? (
            /* Connected state */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-900">Slack connected</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Alerts are being posted to your Slack channel
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={disconnectSlack}
                  disabled={disconnectingSlack}
                >
                  {disconnectingSlack ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : null}
                  Disconnect Slack
                </Button>
                <a href="/api/slack/connect">
                  <Button variant="outline" size="sm" className="border-slate-200">
                    Reconnect to different channel
                  </Button>
                </a>
              </div>
            </div>
          ) : (
            /* Not connected state */
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                {[
                  "Instant alerts when competitor mention rates change",
                  "Real-time notification when your brand visibility drops",
                  "Scan complete summaries in your team channel",
                ].map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2.5">
                    <Bell className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-600">{benefit}</p>
                  </div>
                ))}
              </div>

              {process.env.NEXT_PUBLIC_SLACK_ENABLED === "true" || true ? (
                <a href="/api/slack/connect">
                  <Button className="bg-[#4A154B] hover:bg-[#3a1039] text-white gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.687 8.834a2.528 2.528 0 0 1-2.521 2.521 2.527 2.527 0 0 1-2.521-2.521V2.522A2.527 2.527 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zM15.166 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.166 24a2.527 2.527 0 0 1-2.521-2.522v-2.522h2.521zM15.166 17.687a2.527 2.527 0 0 1-2.521-2.521 2.526 2.526 0 0 1 2.521-2.521h6.312A2.527 2.527 0 0 1 24 15.166a2.528 2.528 0 0 1-2.522 2.521h-6.312z" />
                    </svg>
                    Add to Slack
                  </Button>
                </a>
              ) : (
                <p className="text-xs text-slate-400">
                  Slack integration coming soon. Set SLACK_CLIENT_ID to enable.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
