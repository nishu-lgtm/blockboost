import { Button, Hr, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface WeekData {
  mentionRate: number;
  mentionRatePrev: number;
  totalScans: number;
  topPlatform: string;
  topActions: string[];
  setupStepsComplete: number;
}

interface Props {
  firstName: string;
  weekData: WeekData;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function A6Weekly({
  firstName = "there",
  weekData = {
    mentionRate: 34,
    mentionRatePrev: 0,
    totalScans: 1,
    topPlatform: "ChatGPT",
    topActions: [
      "Add 2 competitors to unlock comparison data",
      "Generate your first content brief",
      "Connect Google Search Console for deeper insights",
    ],
    setupStepsComplete: 2,
  },
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const diff = weekData.mentionRate - weekData.mentionRatePrev;
  const ctaUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/dashboard`)}`;

  return (
    <EmailLayout
      preview="Your first BlockBoost weekly report"
      userId={userId}
      emailType="weeklyReport"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>Your first BlockBoost weekly report 📊</Text>
        <Text style={styles.p}>Hi {firstName} — here&apos;s your week 1 summary.</Text>

        {/* Stats row */}
        <Section style={{ margin: "0 0 24px", textAlign: "center" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                {[
                  { value: `${weekData.mentionRate}%`, label: "AI Mention Rate" },
                  { value: String(weekData.totalScans), label: "Scans Run" },
                  { value: weekData.topPlatform, label: "Top Platform" },
                ].map((s, i) => (
                  <td key={i} style={{ width: "33%", textAlign: "center", padding: "12px 8px", borderRight: i < 2 ? "1px solid #E5E7EB" : "none" }}>
                    <Text style={{ fontSize: "22px", fontWeight: "800", color: colors.gray900, margin: 0 }}>{s.value}</Text>
                    <Text style={{ fontSize: "11px", color: colors.gray400, margin: "4px 0 0" }}>{s.label}</Text>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Section>

        {weekData.mentionRatePrev > 0 && (
          <Section style={styles.callout}>
            <Text style={styles.calloutText}>
              {diff >= 0 ? `📈 Up ${diff}%` : `📉 Down ${Math.abs(diff)}%`} from last week
            </Text>
          </Section>
        )}

        {/* Setup progress */}
        <Hr style={styles.hr} />
        <Text style={{ ...styles.p, fontWeight: "600" }}>
          Setup progress: {weekData.setupStepsComplete}/5 steps complete
        </Text>
        <Section style={{ backgroundColor: "#F3F4F6", borderRadius: "8px", height: "8px", margin: "0 0 20px", overflow: "hidden" }}>
          <Section style={{ backgroundColor: colors.amber, height: "8px", width: `${(weekData.setupStepsComplete / 5) * 100}%`, borderRadius: "8px" }} />
        </Section>

        {/* Top actions */}
        <Text style={{ ...styles.p, fontWeight: "600" }}>Your top 3 actions for week 2:</Text>
        {weekData.topActions.slice(0, 3).map((action, i) => (
          <Text key={i} style={{ ...styles.p, paddingLeft: "0", margin: "0 0 8px" }}>
            <span style={{ color: colors.amber, fontWeight: "700" }}>{i + 1}.</span>{" "}{action}
          </Text>
        ))}

        <Section style={styles.buttonSection}>
          <Button href={ctaUrl} style={styles.button}>
            View full dashboard →
          </Button>
        </Section>
      </Section>
      <img src={`${APP_URL}/api/email/track/open?id=${trackingId}`} width="1" height="1" alt="" style={{ display: "block" }} />
    </EmailLayout>
  );
}
