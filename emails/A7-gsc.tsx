import { Button, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function A7GSC({
  firstName = "there",
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard/settings?tab=integrations`)}`;

  return (
    <EmailLayout
      preview="Unlock 50 more tracking prompts — free"
      userId={userId}
      emailType="tips"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>Unlock 50 more tracking prompts — free</Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          Right now, BlockBoost tracks a set of standard prompts for your industry. But
          the most valuable data comes from what <em>your actual customers</em> are already
          searching for.
        </Text>

        <Text style={styles.p}>
          That&apos;s what Google Search Console unlocks.
        </Text>

        <Section style={{ backgroundColor: "#F8FAFC", borderRadius: "16px", padding: "20px 24px", margin: "0 0 24px" }}>
          <Text style={{ color: "#111827", fontSize: "14px", lineHeight: "1.8", margin: 0 }}>
            <strong>When you connect GSC, we automatically:</strong>
            <br /><br />
            🔍 Import your top 50 real search queries from Google
            <br />
            🤖 Convert them into AI-format tracking prompts
            <br />
            📊 Show you which of those real searches also appear in ChatGPT and Perplexity
            <br />
            🎯 Flag the highest-value gaps between Google traffic and AI visibility
          </Text>
        </Section>

        <Section style={styles.callout}>
          <Text style={styles.calloutText}>
            💡 Your customers are already searching — we just need to know what they&apos;re typing.
          </Text>
        </Section>

        <Text style={styles.p}>
          Connecting takes 2 minutes and uses read-only access. We never modify your Google
          data.
        </Text>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            Connect Google Search Console →
          </Button>
        </Section>

        <Text style={styles.pSmall}>
          Settings → Integrations → Google Search Console
        </Text>
      </Section>
      <img src={`${APP_URL}/api/email/track/open?id=${trackingId}`} width="1" height="1" alt="" style={{ display: "block" }} />
    </EmailLayout>
  );
}
