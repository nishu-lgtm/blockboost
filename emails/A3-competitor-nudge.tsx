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

export default function A3CompetitorNudge({
  firstName = "there",
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard`)}`;

  return (
    <EmailLayout
      preview="Are your competitors stealing AI recommendations from you?"
      userId={userId}
      emailType="tips"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>
          Are your competitors stealing AI recommendations from you?
        </Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          Last week, a dentist in Austin discovered her competitor was appearing in ChatGPT
          4× more than she was for searches like &quot;best family dentist near me.&quot;
        </Text>

        <Text style={styles.p}>
          She had no idea it was happening. Neither did her competitor — they just happened
          to have better AI-optimised content. Once she saw the gap, she fixed it in two
          weeks with a single blog post.
        </Text>

        <Text style={styles.p}>
          <strong>Have you checked yours yet?</strong>
        </Text>

        <Text style={styles.p}>
          Adding 2–3 competitors takes about 60 seconds, and it unlocks:
        </Text>

        <Text style={{ ...styles.p, paddingLeft: "16px" }}>
          📊 Head-to-head mention rate comparison (you vs. them)
          <br />
          🎯 The exact searches where they beat you
          <br />
          📝 Content briefs designed to close those specific gaps
        </Text>

        <Section style={styles.callout}>
          <Text style={styles.calloutText}>
            💡 Businesses that track competitors are 3× more likely to improve their AI
            visibility score in the first month.
          </Text>
        </Section>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            Add my competitors →
          </Button>
        </Section>

        <Text style={styles.pSmall}>
          It takes 60 seconds. You can always remove them later.
        </Text>
      </Section>
      <img src={`${APP_URL}/api/email/track/open?id=${trackingId}`} width="1" height="1" alt="" style={{ display: "block" }} />
    </EmailLayout>
  );
}
