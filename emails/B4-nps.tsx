import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./layout";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

interface Props {
  firstName: string;
  userId: string;
  unsubscribeToken: string;
  trackingId: string;
}

export default function B4NPS({
  firstName = "there",
  userId,
  unsubscribeToken,
  trackingId,
}: Props) {
  const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <EmailLayout
      preview="Quick question — how likely are you to recommend us?"
      userId={userId}
      emailType="tips"
      unsubscribeToken={unsubscribeToken}
    >
      <Section style={styles.content}>
        <Text style={styles.h1}>How are we doing?</Text>

        <Text style={styles.p}>Hi {firstName},</Text>

        <Text style={styles.p}>
          You&apos;ve been using BlockBoost for about a month. One quick
          question:
        </Text>

        <Text
          style={{
            fontSize: "18px",
            fontWeight: "700",
            color: "#111827",
            textAlign: "center" as const,
            margin: "0 0 20px",
          }}
        >
          How likely are you to recommend BlockBoost
          <br />
          to a friend or colleague?
        </Text>

        {/* NPS scale */}
        <Section style={{ margin: "0 0 12px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "4px",
            }}
          >
            <tbody>
              <tr>
                {scores.map((score) => {
                  const npsUrl = `${APP_URL}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(`${APP_URL}/api/email/nps?userId=${userId}&score=${score}`)}`;
                  const isLow = score <= 6;
                  const isMid = score >= 7 && score <= 8;
                  const isHigh = score >= 9;
                  const bg = isHigh
                    ? colors.amber
                    : isMid
                    ? "#FDE68A"
                    : "#F3F4F6";
                  const textColor = isHigh ? "#ffffff" : "#111827";
                  return (
                    <td
                      key={score}
                      style={{ width: "9%", textAlign: "center" as const }}
                    >
                      <a
                        href={npsUrl}
                        style={{
                          display: "block",
                          backgroundColor: bg,
                          color: textColor,
                          fontSize: "14px",
                          fontWeight: "700",
                          textDecoration: "none",
                          borderRadius: "8px",
                          padding: "10px 0",
                          width: "100%",
                        }}
                      >
                        {score}
                      </a>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </Section>

        <Section style={{ margin: "0 0 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ textAlign: "left" as const }}>
                  <Text
                    style={{ fontSize: "11px", color: "#9CA3AF", margin: 0 }}
                  >
                    Not at all likely
                  </Text>
                </td>
                <td style={{ textAlign: "right" as const }}>
                  <Text
                    style={{ fontSize: "11px", color: "#9CA3AF", margin: 0 }}
                  >
                    Extremely likely
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Text style={{ ...styles.p, color: "#6B7280" }}>
          This takes one click and helps us understand what&apos;s working and
          what to build next. No login required.
        </Text>

        <Text
          style={{ ...styles.pSmall, marginTop: "24px", color: colors.gray400 }}
        >
          — Tom, BlockBoost
          <br />
          <br />
          P.S. If your score is 6 or below, please reply to this email and tell
          me why. I personally read every response and use it to improve the
          product.
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
