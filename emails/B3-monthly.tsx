import { Button, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface MonthData {
  monthName: string;
  mentionRate: number;
  mentionRatePrev: number;
  scansRun: number;
  topGainPrompt: string;
  topGainPoints: number;
  topCompetitorName: string;
  topCompetitorRate: number;
  briefsGenerated: number;
}

interface Props {
  firstName: string;
  monthData: MonthData;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function B3Monthly({
  firstName = "there",
  monthData = {
    monthName: "April",
    mentionRate: 42,
    mentionRatePrev: 31,
    scansRun: 8,
    topGainPrompt: "best accountant for small business",
    topGainPoints: 18,
    topCompetitorName: "Rival Co",
    topCompetitorRate: 58,
    briefsGenerated: 2,
  },
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard`)}`;
  const diff = monthData.mentionRate - monthData.mentionRatePrev;
  const isUp = diff >= 0;

  return (
    <EmailLayout
      preview={`Your ${monthData.monthName} AI visibility summary`}
      userId={userId}
      emailType="weeklyReport"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>
          Your {monthData.monthName} AI visibility summary
        </Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          Here&apos;s what happened to your AI visibility in{" "}
          {monthData.monthName}.
        </Text>

        {/* Key metric */}
        <Section
          style={{
            textAlign: "center" as const,
            backgroundColor: "#F8FAFC",
            borderRadius: "16px",
            padding: "24px",
            margin: "0 0 24px",
          }}
        >
          <Text
            style={{
              fontSize: "48px",
              fontWeight: "800",
              color: isUp ? "#16A34A" : "#DC2626",
              margin: "0 0 4px",
              lineHeight: "1",
            }}
          >
            {mentionRateDisplay(monthData.mentionRate)}
          </Text>
          <Text
            style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 12px" }}
          >
            AI mention rate
          </Text>
          <Text
            style={{
              display: "inline-block" as const,
              backgroundColor: isUp ? "#DCFCE7" : "#FEE2E2",
              color: isUp ? "#16A34A" : "#DC2626",
              fontSize: "13px",
              fontWeight: "700",
              padding: "4px 12px",
              borderRadius: "100px",
              margin: 0,
            }}
          >
            {isUp ? "▲" : "▼"} {Math.abs(diff)}% vs last month
          </Text>
        </Section>

        {/* Stats grid */}
        <Section
          style={{
            margin: "0 0 24px",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td
                  style={{
                    width: "33%",
                    textAlign: "center",
                    padding: "12px 8px",
                    borderRight: "1px solid #E5E7EB",
                  }}
                >
                  <Text
                    style={{
                      fontSize: "22px",
                      fontWeight: "800",
                      color: colors.gray900,
                      margin: 0,
                    }}
                  >
                    {monthData.scansRun}
                  </Text>
                  <Text
                    style={{
                      fontSize: "11px",
                      color: colors.gray400,
                      margin: "4px 0 0",
                    }}
                  >
                    Scans Run
                  </Text>
                </td>
                <td
                  style={{
                    width: "33%",
                    textAlign: "center",
                    padding: "12px 8px",
                    borderRight: "1px solid #E5E7EB",
                  }}
                >
                  <Text
                    style={{
                      fontSize: "22px",
                      fontWeight: "800",
                      color: colors.gray900,
                      margin: 0,
                    }}
                  >
                    {monthData.topCompetitorRate}%
                  </Text>
                  <Text
                    style={{
                      fontSize: "11px",
                      color: colors.gray400,
                      margin: "4px 0 0",
                    }}
                  >
                    {monthData.topCompetitorName}
                  </Text>
                </td>
                <td
                  style={{
                    width: "33%",
                    textAlign: "center",
                    padding: "12px 8px",
                  }}
                >
                  <Text
                    style={{
                      fontSize: "22px",
                      fontWeight: "800",
                      color: colors.gray900,
                      margin: 0,
                    }}
                  >
                    {monthData.briefsGenerated}
                  </Text>
                  <Text
                    style={{
                      fontSize: "11px",
                      color: colors.gray400,
                      margin: "4px 0 0",
                    }}
                  >
                    Briefs Generated
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* Top gain */}
        {monthData.topGainPoints > 0 && (
          <Section style={styles.callout}>
            <Text style={styles.calloutText}>
              📈 Biggest gain: &ldquo;{monthData.topGainPrompt}&rdquo; —{" "}
              <strong>+{monthData.topGainPoints}%</strong> mention rate this
              month
            </Text>
          </Section>
        )}

        <Hr style={styles.hr} />

        {/* Gap vs competitor */}
        {monthData.topCompetitorRate > monthData.mentionRate ? (
          <>
            <Text style={{ ...styles.p, fontWeight: "600" }}>
              Still {monthData.topCompetitorRate - monthData.mentionRate} points
              behind {monthData.topCompetitorName}
            </Text>
            <Text style={styles.p}>
              Your dashboard shows the exact prompts where they appear and you
              don&apos;t. Generating a content brief for the top gap is the
              fastest way to close it.
            </Text>
          </>
        ) : (
          <Text style={styles.p}>
            You&apos;re ahead of {monthData.topCompetitorName} this month. Keep
            publishing — the gap will widen as more content gets indexed.
          </Text>
        )}

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            View full dashboard →
          </Button>
        </Section>
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

function mentionRateDisplay(rate: number): string {
  return `${rate}%`;
}
