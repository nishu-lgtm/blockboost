import { Button, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  planName: string;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function B1PaidWelcome({
  firstName = "there",
  planName = "Growth",
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard`)}`;
  const gscUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard/settings?tab=integrations`)}`;
  const briefUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard/briefs`)}`;

  return (
    <EmailLayout
      preview={`Welcome to BlockBoost ${planName} 🎉`}
      userId={userId}
      emailType="billing"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>You&apos;re on BlockBoost {planName} 🎉</Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          Welcome to the paid side. Your weekly AI scans are running, competitor
          tracking is live, and your account is fully unlocked.
        </Text>

        <Text style={styles.p}>
          Here are the three things that move the needle fastest — most paid
          users see results within 2–3 weeks when they do all three:
        </Text>

        <Hr style={styles.hr} />

        {/* Power feature 1 */}
        <Section style={{ margin: "0 0 20px" }}>
          <Text
            style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "#111827",
              margin: "0 0 6px",
            }}
          >
            <span style={{ color: colors.amber }}>1.</span> Connect Google
            Search Console
          </Text>
          <Text style={{ ...styles.p, margin: "0 0 8px" }}>
            Imports your top 50 real search queries and converts them into
            AI-format tracking prompts — automatically. It&apos;s the fastest
            way to go from generic data to insights that match what your actual
            customers search for.
          </Text>
          <Text style={{ ...styles.pSmall, margin: 0 }}>
            <a href={gscUrl} style={{ color: colors.amber }}>
              Connect GSC in 2 minutes →
            </a>
          </Text>
        </Section>

        {/* Power feature 2 */}
        <Section style={{ margin: "0 0 20px" }}>
          <Text
            style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "#111827",
              margin: "0 0 6px",
            }}
          >
            <span style={{ color: colors.amber }}>2.</span> Generate a content
            brief for your #1 gap
          </Text>
          <Text style={{ ...styles.p, margin: "0 0 8px" }}>
            Your dashboard shows the exact prompts where competitors appear but
            you don&apos;t. Pick the most relevant one and generate a brief.
            Paste it into ChatGPT for a first draft, publish it, and you
            typically see it picked up by AI assistants within 2–4 weeks.
          </Text>
          <Text style={{ ...styles.pSmall, margin: 0 }}>
            <a href={briefUrl} style={{ color: colors.amber }}>
              Generate your first brief →
            </a>
          </Text>
        </Section>

        {/* Power feature 3 */}
        <Section style={{ margin: "0 0 24px" }}>
          <Text
            style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "#111827",
              margin: "0 0 6px",
            }}
          >
            <span style={{ color: colors.amber }}>3.</span> Add 2–3 competitors
          </Text>
          <Text style={{ ...styles.p, margin: 0 }}>
            The more competitors you track, the more gap data you get. Most
            users with 3+ competitors find at least one &quot;easy win&quot; gap
            — a question where a competitor ranks but the content is thin and
            easy to beat.
          </Text>
        </Section>

        <Hr style={styles.hr} />

        <Section style={styles.callout}>
          <Text style={styles.calloutText}>
            💡 Most paid users who do all three within their first week see a
            10–30% improvement in their AI mention rate within a month.
          </Text>
        </Section>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            Open my dashboard →
          </Button>
        </Section>

        <Text
          style={{ ...styles.pSmall, marginTop: "16px", color: colors.gray400 }}
        >
          Reply to this email anytime — I read and respond to every one.
          <br />— Tom, BlockBoost
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
