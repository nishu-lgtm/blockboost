import { Button, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  daysSincePaid: number;
  mentionRate: number;
  topCompetitorName: string;
  topCompetitorRate: number;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function B2Report({
  firstName = "there",
  daysSincePaid = 21,
  mentionRate = 28,
  topCompetitorName = "your top competitor",
  topCompetitorRate = 61,
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard/reports`)}`;
  const gap = Math.max(0, topCompetitorRate - mentionRate);

  return (
    <EmailLayout
      preview="Your AI visibility report is ready to generate"
      userId={userId}
      emailType="weeklyReport"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>
          {daysSincePaid} days in — here&apos;s what your data shows
        </Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          You&apos;ve been on BlockBoost for {daysSincePaid} days. Your scans
          have been running, data has been accumulating — but you haven&apos;t
          generated a report yet.
        </Text>

        <Text style={styles.p}>
          A report takes all your scan data and turns it into a single,
          shareable document: your AI visibility score over time, the gap vs.
          competitors, and the highest-value content opportunities ranked by
          impact.
        </Text>

        {/* Stats comparison */}
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
                    {mentionRate}%
                  </Text>
                  <Text
                    style={{
                      fontSize: "11px",
                      color: "#6B7280",
                      margin: "4px 0 0",
                    }}
                  >
                    Your mention rate
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
                      color: "#111827",
                      margin: 0,
                    }}
                  >
                    {topCompetitorRate}%
                  </Text>
                  <Text
                    style={{
                      fontSize: "11px",
                      color: "#6B7280",
                      margin: "4px 0 0",
                    }}
                  >
                    {topCompetitorName}
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
          {gap > 0 && (
            <Text
              style={{
                textAlign: "center" as const,
                fontSize: "13px",
                color: "#DC2626",
                fontWeight: "600",
                margin: "12px 0 0",
              }}
            >
              {gap}-point gap to close
            </Text>
          )}
        </Section>

        <Section style={styles.callout}>
          <Text style={styles.calloutText}>
            📄 Your report will show exactly which content to create first to
            close that gap fastest.
          </Text>
        </Section>

        <Text style={styles.p}>
          It takes 30 seconds to generate. Most users share it with their
          marketing team or content writer to align on priorities.
        </Text>

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            Generate my report →
          </Button>
        </Section>

        <Text style={styles.pSmall}>
          Reports are PDF exports you can share with your team or use in
          client presentations.
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
