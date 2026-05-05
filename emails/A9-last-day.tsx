import { Button, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  promptCount: number;
  competitorCount: number;
  briefCount: number;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function A9LastDay({
  firstName = "there",
  promptCount = 10,
  competitorCount = 2,
  briefCount = 1,
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/pricing`)}`;

  return (
    <EmailLayout
      preview="Last day of your free trial ⏰"
      userId={userId}
      emailType="billing"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>Last day of your free trial ⏰</Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          Your BlockBoost trial ends tomorrow. Here&apos;s what will be paused
          if you don&apos;t upgrade today:
        </Text>

        {/* What gets paused */}
        <Section
          style={{
            backgroundColor: "#FEF3C7",
            border: "1px solid #F59E0B",
            borderRadius: "12px",
            padding: "20px 24px",
            margin: "0 0 24px",
          }}
        >
          <Text
            style={{
              color: "#92400E",
              fontSize: "14px",
              lineHeight: "1.9",
              margin: 0,
            }}
          >
            ⏸️{" "}
            <strong>
              {promptCount} tracking prompt{promptCount !== 1 ? "s" : ""}
            </strong>{" "}
            — AI scans will stop running
            <br />
            ⏸️{" "}
            <strong>
              {competitorCount} competitor comparison
              {competitorCount !== 1 ? "s" : ""}
            </strong>{" "}
            — gap tracking paused
            <br />
            ⏸️{" "}
            <strong>
              {briefCount} content brief{briefCount !== 1 ? "s" : ""}
            </strong>{" "}
            — no new briefs can be generated
            <br />
            ⏸️ <strong>Weekly reports</strong> — you won&apos;t know if
            competitors are gaining
          </Text>
        </Section>

        <Text style={styles.p}>
          The good news: your data stays safe for 30 days. But the scans that
          tell you how you&apos;re doing against competitors? Those stop
          tomorrow.
        </Text>

        <Text style={styles.p}>
          Upgrading takes 60 seconds. No contract — cancel anytime.
        </Text>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            Upgrade now →
          </Button>
        </Section>

        <Text style={styles.pSmall}>
          Growth plan — $299/month &nbsp;·&nbsp; Starter plan — $79/month
          <br />
          Questions? Reply to this email — I read every one.
        </Text>

        <Text
          style={{ ...styles.pSmall, marginTop: "16px", color: colors.gray400 }}
        >
          — Tom, BlockBoost
        </Text>
      </Section>
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
