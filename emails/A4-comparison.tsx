import { Button, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface GapPrompt {
  text: string;
  competitorMentionRate: number;
  yourMentionRate: number;
}

interface Props {
  firstName: string;
  competitorName: string;
  yourMentionRate: number;
  competitorMentionRate: number;
  gapPrompts: GapPrompt[];
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function A4Comparison({
  firstName = "there",
  competitorName = "your top competitor",
  yourMentionRate = 28,
  competitorMentionRate = 61,
  gapPrompts = [],
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const diff = competitorMentionRate - yourMentionRate;
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard`)}`;

  return (
    <EmailLayout
      preview={`${firstName}, here's how you compare to ${competitorName}`}
      userId={userId}
      emailType="tips"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>
          {firstName}, here&apos;s how you compare to {competitorName}
        </Text>

        <Text style={styles.p}>
          We ran your first competitor comparison. Here&apos;s what we found:
        </Text>

        {/* Comparison bar */}
        <Section style={{ backgroundColor: "#F8FAFC", borderRadius: "16px", padding: "24px", margin: "0 0 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ width: "50%", textAlign: "center", padding: "8px" }}>
                  <Text style={{ fontSize: "28px", fontWeight: "800", color: colors.amber, margin: 0 }}>
                    {yourMentionRate}%
                  </Text>
                  <Text style={{ fontSize: "12px", color: "#6B7280", margin: "4px 0 0" }}>You</Text>
                </td>
                <td style={{ width: "50%", textAlign: "center", padding: "8px", borderLeft: "1px solid #E5E7EB" }}>
                  <Text style={{ fontSize: "28px", fontWeight: "800", color: "#EF4444", margin: 0 }}>
                    {competitorMentionRate}%
                  </Text>
                  <Text style={{ fontSize: "12px", color: "#6B7280", margin: "4px 0 0" }}>{competitorName}</Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Text style={styles.p}>
          <strong>{competitorName}</strong> appears {diff > 0 ? `${diff} percentage points` : "about the same amount"} more
          than you across AI platforms. {diff > 20 ? "That&apos;s a significant gap — but it&apos;s very closeable." : "You&apos;re closer than you might think."}
        </Text>

        {gapPrompts.length > 0 && (
          <>
            <Text style={{ ...styles.p, fontWeight: "600" }}>
              The 3 specific searches where they beat you:
            </Text>
            {gapPrompts.slice(0, 3).map((gap, i) => (
              <Section key={i} style={{ ...styles.callout, marginTop: i === 0 ? "0" : "8px" }}>
                <Text style={{ ...styles.calloutText, fontWeight: "400" }}>
                  <strong>"{gap.text}"</strong>
                  <br />
                  Them: {gap.competitorMentionRate}% · You: {gap.yourMentionRate}%
                </Text>
              </Section>
            ))}
          </>
        )}

        <Hr style={styles.hr} />

        <Text style={styles.p}>
          Good news: a single well-optimised content brief can close this gap for 1–2 of
          these searches. BlockBoost has already identified the content you need to write.
        </Text>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            Get my content brief →
          </Button>
        </Section>
      </Section>
      <img src={`${APP_URL}/api/email/track/open?id=${trackingId}`} width="1" height="1" alt="" style={{ display: "block" }} />
    </EmailLayout>
  );
}
