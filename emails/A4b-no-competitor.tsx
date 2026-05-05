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

export default function A4bNoCompetitor({
  firstName = "there",
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard`)}`;

  return (
    <EmailLayout
      preview="What are you missing without competitor tracking?"
      userId={userId}
      emailType="tips"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>
          What are you missing without competitor tracking?
        </Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          Right now you&apos;re flying blind. You can see <em>your</em> AI visibility —
          but you have no idea how it compares to the businesses competing for the same
          customers.
        </Text>

        <Text style={styles.p}>
          Here&apos;s what competitor tracking unlocks:
        </Text>

        <Section style={{ backgroundColor: "#F8FAFC", borderRadius: "16px", padding: "20px 24px", margin: "0 0 24px" }}>
          <Text style={{ color: "#111827", fontSize: "14px", lineHeight: "1.8", margin: 0 }}>
            <strong>📊 Side-by-side mention rates</strong>
            <br />
            See exactly how often you vs. competitors appear in ChatGPT, Perplexity, and Gemini for the same searches.
            <br /><br />
            <strong>🎯 The exact gaps</strong>
            <br />
            Find the specific questions where competitors appear but you don&apos;t — these are your highest-value content opportunities.
            <br /><br />
            <strong>📈 Trend tracking</strong>
            <br />
            Watch the gap close as your content strategy works. Know when you overtake them.
          </Text>
        </Section>

        <Text style={styles.p}>
          Adding a competitor takes 30 seconds. You just need their business name.
        </Text>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            Add my first competitor →
          </Button>
        </Section>

        <Text style={styles.pSmall}>
          Most users add 2–3 competitors. The more you add, the richer your data.
        </Text>
      </Section>
      <img src={`${APP_URL}/api/email/track/open?id=${trackingId}`} width="1" height="1" alt="" style={{ display: "block" }} />
    </EmailLayout>
  );
}
