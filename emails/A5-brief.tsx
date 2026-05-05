import { Button, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  gapCount: number;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function A5Brief({
  firstName = "there",
  gapCount = 7,
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard`)}`;

  return (
    <EmailLayout
      preview="The 5-minute content fix that gets you into AI answers"
      userId={userId}
      emailType="tips"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>
          The 5-minute content fix that gets you into AI answers
        </Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          Here&apos;s something most business owners don&apos;t realise: AI assistants don&apos;t make up
          their recommendations. They pull from content that exists on the web. If you&apos;re
          not in their answers, it&apos;s because you don&apos;t have the right content yet.
        </Text>

        <Text style={styles.p}>
          That&apos;s exactly what content briefs fix.
        </Text>

        <Section style={{ backgroundColor: "#F8FAFC", borderRadius: "16px", padding: "20px 24px", margin: "0 0 24px" }}>
          <Text style={{ color: "#111827", fontSize: "14px", lineHeight: "1.8", margin: 0 }}>
            <strong>What a BlockBoost content brief gives you:</strong>
            <br /><br />
            ✅ The exact question to answer (matched to a real AI search)
            <br />
            ✅ The structure ChatGPT and Perplexity want to see
            <br />
            ✅ FAQ markup that makes AI cite you directly
            <br />
            ✅ E-E-A-T signals to establish authority
          </Text>
        </Section>

        <Section style={styles.callout}>
          <Text style={styles.calloutText}>
            📊 We found {gapCount} searches where your competitors appear but you don&apos;t.
          </Text>
          <Text style={{ ...styles.calloutBody, marginTop: "6px" }}>
            One blog post from a single brief can double your mention rate on Perplexity for
            that topic.
          </Text>
        </Section>

        <Hr style={styles.hr} />

        <Text style={styles.p}>
          Generating a brief takes 30 seconds. Writing the content? About 2 hours — or
          paste the brief straight into ChatGPT and get a first draft in minutes.
        </Text>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            Generate my first brief →
          </Button>
        </Section>

        <Text style={styles.pSmall}>
          Users who generate at least one brief in their first week are 4× more likely to
          see measurable improvement in their AI visibility score.
        </Text>
      </Section>
      <img src={`${APP_URL}/api/email/track/open?id=${trackingId}`} width="1" height="1" alt="" style={{ display: "block" }} />
    </EmailLayout>
  );
}
