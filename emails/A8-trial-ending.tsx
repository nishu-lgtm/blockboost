import { Button, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  scansRun: number;
  mentionRate: number;
  competitorCount: number;
  topInsight: string;
  trialEndDate: string;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function A8TrialEnding({
  firstName = "there",
  scansRun = 3,
  mentionRate = 34,
  competitorCount = 0,
  topInsight = "You appear in ChatGPT for 34% of your tracked searches",
  trialEndDate = "in 3 days",
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/pricing`)}`;

  return (
    <EmailLayout
      preview={`Your free trial ends in 3 days`}
      userId={userId}
      emailType="billing"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>Your free trial ends {trialEndDate}</Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          Before your trial ends, here&apos;s a summary of what you&apos;ve discovered about your
          AI visibility:
        </Text>

        {/* Stats */}
        <Section style={{ backgroundColor: "#F8FAFC", borderRadius: "16px", padding: "20px 24px", margin: "0 0 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                {[
                  { value: String(scansRun), label: "AI Scans Run" },
                  { value: `${mentionRate}%`, label: "Mention Rate" },
                  { value: String(competitorCount), label: "Competitors Tracked" },
                ].map((s, i) => (
                  <td key={i} style={{ width: "33%", textAlign: "center", padding: "12px 8px", borderRight: i < 2 ? "1px solid #E5E7EB" : "none" }}>
                    <Text style={{ fontSize: "24px", fontWeight: "800", color: colors.amber, margin: 0 }}>{s.value}</Text>
                    <Text style={{ fontSize: "11px", color: "#6B7280", margin: "4px 0 0" }}>{s.label}</Text>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Section>

        <Text style={{ ...styles.p, fontWeight: "600" }}>Your best insight from this trial:</Text>
        <Section style={styles.callout}>
          <Text style={styles.calloutText}>{topInsight}</Text>
        </Section>

        <Hr style={styles.hr} />

        <Text style={{ ...styles.p, fontWeight: "600" }}>
          Here&apos;s what you&apos;ll lose if you don&apos;t upgrade:
        </Text>

        <Text style={{ ...styles.p, paddingLeft: "16px" }}>
          ❌ Weekly AI scans stop running
          <br />
          ❌ Competitor tracking paused
          <br />
          ❌ No new content briefs
          <br />
          ❌ Alert notifications disabled
        </Text>

        <Text style={styles.p}>
          Your data stays safe for 30 days, but you won&apos;t know if your competitors are
          gaining ground while you&apos;re away.
        </Text>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            Keep my BlockBoost data →
          </Button>
        </Section>

        <Text style={styles.pSmall}>
          Growth plan — $299/month. Starter plan — $79/month. No contracts, cancel anytime.
        </Text>
      </Section>
      <img src={`${APP_URL}/api/email/track/open?id=${trackingId}`} width="1" height="1" alt="" style={{ display: "block" }} />
    </EmailLayout>
  );
}
