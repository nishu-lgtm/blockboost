import { Button, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  score: number;
  topOpportunity: string;
  topAction: string;
  dashboardUrl?: string;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

function scoreLabel(score: number): { label: string; color: string; emoji: string } {
  if (score >= 70) return { label: "Strong", color: "#10B981", emoji: "🟢" };
  if (score >= 40) return { label: "Building", color: colors.amber, emoji: "🟡" };
  return { label: "Early stage", color: "#EF4444", emoji: "🔴" };
}

export default function A2Score({
  firstName = "there",
  score = 32,
  topOpportunity = "appearing in ChatGPT searches",
  topAction = "Publish an FAQ page that answers your customers' top 5 questions",
  dashboardUrl,
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const meta = scoreLabel(score);
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(dashboardUrl ?? `${APP_URL}/dashboard`)}`;

  return (
    <EmailLayout
      preview={`Your AI Visibility Score is ${score}/100`}
      userId={userId}
      emailType="tips"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>Your AI Visibility Score is ready</Text>

        {/* Score display */}
        <Section style={{
          backgroundColor: "#F8FAFC",
          borderRadius: "16px",
          padding: "24px",
          textAlign: "center",
          margin: "0 0 24px",
        }}>
          <Text style={{
            fontSize: "64px",
            fontWeight: "800",
            color: meta.color,
            margin: 0,
            lineHeight: 1,
          }}>
            {score}
          </Text>
          <Text style={{ fontSize: "18px", color: "#6B7280", margin: "4px 0 0" }}>
            out of 100
          </Text>
          <Text style={{ fontSize: "14px", fontWeight: "600", color: meta.color, margin: "8px 0 0" }}>
            {meta.emoji} {meta.label}
          </Text>
        </Section>

        <Text style={styles.p}>
          Hi {firstName} — your scan is complete. A score of{" "}
          <strong>{score}/100</strong> means your business is{" "}
          {score < 40
            ? "rarely mentioned when potential customers ask AI assistants for recommendations in your category."
            : score < 70
            ? "mentioned sometimes, but your competitors likely have a significant visibility advantage."
            : "performing well in AI search — let's keep that momentum going."}
        </Text>

        <Text style={{ ...styles.p, fontWeight: "600" }}>
          Your single biggest opportunity right now:
        </Text>

        <Section style={styles.callout}>
          <Text style={styles.calloutText}>🎯 {topOpportunity}</Text>
        </Section>

        <Text style={styles.p}>
          <strong>Here&apos;s your #1 action to improve your score this week:</strong>
        </Text>

        <Text style={{ ...styles.p, paddingLeft: "16px", borderLeft: "3px solid #F59E0B" }}>
          {topAction}
        </Text>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            See my full results →
          </Button>
        </Section>

        <Hr style={styles.hr} />

        <Text style={styles.pSmall}>
          This is your baseline. Businesses that take action in the first week typically see
          a 15–30 point score increase within 30 days.
        </Text>
      </Section>
      <img src={`${APP_URL}/api/email/track/open?id=${trackingId}`} width="1" height="1" alt="" style={{ display: "block" }} />
    </EmailLayout>
  );
}
