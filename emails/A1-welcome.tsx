import { Button, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  dashboardUrl?: string;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function A1Welcome({
  firstName = "there",
  dashboardUrl,
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(dashboardUrl ?? `${APP_URL}/dashboard`)}`;

  return (
    <EmailLayout
      preview={`Welcome to BlockBoost, ${firstName} 👋`}
      userId={userId}
      emailType="tips"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>Welcome to BlockBoost, {firstName} 👋</Text>

        <Text style={styles.p}>
          I&apos;m Tom, founder of BlockBoost. I wanted to personally welcome you — every
          account is still reviewed by a real person here, and yours is no exception.
        </Text>

        <Text style={styles.p}>
          <strong>Your first AI visibility scan is running right now.</strong> In the next
          few minutes, we&apos;ll show you exactly how your business appears (or doesn&apos;t) when
          people ask ChatGPT, Perplexity, Gemini, and Google AI for businesses like yours.
        </Text>

        <Text style={styles.p}>
          Here&apos;s what to expect in the next 5 minutes:
        </Text>

        <Text style={{ ...styles.p, paddingLeft: "16px" }}>
          ✅ Your AI Visibility Score (0–100) — where you stand today
          <br />
          📊 Which AI platforms mention you (and how often)
          <br />
          🎯 Your single biggest opportunity to improve
          <br />
          🏆 How you compare to competitors in your area
        </Text>

        <Text style={styles.p}>
          <strong>One thing to do right now:</strong> Head to your dashboard and check your
          AI Visibility Score. Even if it&apos;s low, knowing your baseline is the first step.
        </Text>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            See my score →
          </Button>
        </Section>

        <Hr style={styles.hr} />

        <Text style={styles.pSmall}>
          P.S. — Reply to this email anytime. I read every one and usually respond within a
          day. Whether it&apos;s a question, feedback, or just saying hi — my inbox is open.
        </Text>

        <Text style={{ ...styles.pSmall, marginTop: "8px" }}>
          — Tom
          <br />
          Founder, BlockBoost
        </Text>
      </Section>

      {/* Open tracking pixel */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${APP_URL}/api/email/track/open?id=${trackingId}`}
        width="1"
        height="1"
        alt=""
        style={{ display: "block" }}
      />
    </EmailLayout>
  );
}
