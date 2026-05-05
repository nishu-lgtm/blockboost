import { Button, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  discountCode: string;
  expiresIn: string;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function A10TrialEnded({
  firstName = "there",
  discountCode = "WELCOME30",
  expiresIn = "48 hours",
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/pricing?code=${discountCode}`)}`;

  return (
    <EmailLayout
      preview="Your BlockBoost trial has ended"
      userId={userId}
      emailType="billing"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>Your BlockBoost trial has ended</Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          Your free trial is over. No hard feelings — we know these decisions
          take time.
        </Text>

        <Text style={styles.p}>
          The good news: your data is safe for the next 30 days. Your scans,
          competitor comparisons, and content briefs are all waiting for you if
          you decide to come back.
        </Text>

        <Hr style={styles.hr} />

        {/* Discount offer */}
        <Section
          style={{
            backgroundColor: "#F8FAFC",
            border: "2px solid #F59E0B",
            borderRadius: "16px",
            padding: "24px",
            margin: "0 0 24px",
            textAlign: "center" as const,
          }}
        >
          <Text
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: colors.amber,
              textTransform: "uppercase" as const,
              letterSpacing: "1px",
              margin: "0 0 8px",
            }}
          >
            One-time offer
          </Text>
          <Text
            style={{
              fontSize: "28px",
              fontWeight: "800",
              color: "#111827",
              margin: "0 0 4px",
              lineHeight: "1.2",
            }}
          >
            30% off your first month
          </Text>
          <Text
            style={{
              fontSize: "13px",
              color: "#6B7280",
              margin: "0 0 16px",
            }}
          >
            Use code{" "}
            <strong style={{ color: "#111827", fontFamily: "monospace" }}>
              {discountCode}
            </strong>{" "}
            — expires in {expiresIn}
          </Text>
          <Button href={ctaUrl} style={styles.button}>
            Claim 30% off →
          </Button>
        </Section>

        <Text style={{ ...styles.p, color: "#6B7280" }}>
          After your first month, you&apos;ll be billed at the regular rate. No
          contracts, cancel anytime.
        </Text>

        <Hr style={styles.hr} />

        <Text style={styles.p}>
          If there was something we could have done better — a missing feature,
          a confusing part of the product, or a price point that didn&apos;t
          work — I genuinely want to know. Just reply to this email.
        </Text>

        <Text
          style={{ ...styles.pSmall, marginTop: "16px", color: colors.gray400 }}
        >
          — Tom, BlockBoost
          <br />
          <br />
          P.S. Your account and data will be fully deleted after 30 days. If you
          want to export anything, log in and head to Settings → Export.
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
