import { Button, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  daysSinceLastLogin: number;
  mentionRate: number;
  topCompetitorName: string;
  topCompetitorRate: number;
  missedScans: number;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function B5Reengagement({
  firstName = "there",
  daysSinceLastLogin = 60,
  mentionRate = 34,
  topCompetitorName = "your top competitor",
  topCompetitorRate = 52,
  missedScans = 8,
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard`)}`;
  const pauseUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard/settings?tab=billing`)}`;
  const gap = Math.max(0, topCompetitorRate - mentionRate);

  return (
    <EmailLayout
      preview="You haven't logged in — here's what you missed"
      userId={userId}
      emailType="tips"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>
          {daysSinceLastLogin} days of data, waiting for you
        </Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          It&apos;s been {daysSinceLastLogin} days since you last logged into
          BlockBoost. Your scans kept running and data kept accumulating — here
          is what happened while you were away:
        </Text>

        {/* What you missed */}
        <Section
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: "16px",
            padding: "20px 24px",
            margin: "0 0 24px",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td
                  style={{
                    width: "50%",
                    textAlign: "center",
                    padding: "12px 8px",
                    borderRight: "1px solid #E5E7EB",
                  }}
                >
                  <Text
                    style={{
                      fontSize: "28px",
                      fontWeight: "800",
                      color: colors.amber,
                      margin: 0,
                    }}
                  >
                    {missedScans}
                  </Text>
                  <Text
                    style={{
                      fontSize: "11px",
                      color: "#6B7280",
                      margin: "4px 0 0",
                    }}
                  >
                    Scans you haven&apos;t reviewed
                  </Text>
                </td>
                <td
                  style={{
                    width: "50%",
                    textAlign: "center",
                    padding: "12px 8px",
                  }}
                >
                  <Text
                    style={{
                      fontSize: "28px",
                      fontWeight: "800",
                      color: gap > 0 ? "#DC2626" : "#16A34A",
                      margin: 0,
                    }}
                  >
                    {gap > 0 ? `+${gap}%` : "0%"}
                  </Text>
                  <Text
                    style={{
                      fontSize: "11px",
                      color: "#6B7280",
                      margin: "4px 0 0",
                    }}
                  >
                    {gap > 0
                      ? `Gap vs ${topCompetitorName}`
                      : "Ahead of competitors"}
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        {gap > 10 && (
          <Section style={styles.callout}>
            <Text style={styles.calloutText}>
              ⚠️ {topCompetitorName} is now {gap} points ahead of you in AI
              visibility. This gap typically takes 6–8 weeks to close without
              action.
            </Text>
          </Section>
        )}

        <Text style={styles.p}>
          Your account is fully active — you&apos;re still being charged and
          scans are still running. All your data is waiting in the dashboard.
        </Text>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            See what I missed →
          </Button>
        </Section>

        <Hr style={styles.hr} />

        <Text style={{ ...styles.p, color: "#6B7280" }}>
          Not using BlockBoost actively right now? You can{" "}
          <a href={pauseUrl} style={{ color: colors.amber }}>
            pause your subscription
          </a>{" "}
          for up to 3 months without losing your data — you&apos;ll only pay
          when you&apos;re actively using it.
        </Text>

        <Text
          style={{ ...styles.pSmall, marginTop: "16px", color: colors.gray400 }}
        >
          — Tom, BlockBoost
          <br />
          <br />
          Reply to this email if there&apos;s something we could do better.
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
