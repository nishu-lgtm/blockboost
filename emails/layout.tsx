import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

export const colors = {
  amber: "#F59E0B",
  amberDark: "#D97706",
  amberLight: "#FFFBEB",
  gray900: "#111827",
  gray600: "#4B5563",
  gray400: "#9CA3AF",
  gray100: "#F3F4F6",
  white: "#FFFFFF",
};

export const styles = {
  body: {
    backgroundColor: "#F1F5F9",
    fontFamily:
      "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    margin: 0,
    padding: 0,
  } as React.CSSProperties,

  container: {
    backgroundColor: colors.white,
    borderRadius: "16px",
    margin: "40px auto",
    maxWidth: "600px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    overflow: "hidden",
  } as React.CSSProperties,

  header: {
    backgroundColor: colors.amber,
    padding: "20px 32px",
  } as React.CSSProperties,

  logoText: {
    color: colors.white,
    fontSize: "20px",
    fontWeight: "800",
    letterSpacing: "-0.5px",
    margin: 0,
  } as React.CSSProperties,

  content: {
    padding: "32px",
  } as React.CSSProperties,

  h1: {
    color: colors.gray900,
    fontSize: "22px",
    fontWeight: "700",
    lineHeight: "1.35",
    margin: "0 0 16px",
  } as React.CSSProperties,

  p: {
    color: colors.gray600,
    fontSize: "15px",
    lineHeight: "1.7",
    margin: "0 0 16px",
  } as React.CSSProperties,

  pSmall: {
    color: colors.gray400,
    fontSize: "13px",
    lineHeight: "1.6",
    margin: "0 0 12px",
  } as React.CSSProperties,

  button: {
    backgroundColor: colors.amber,
    borderRadius: "10px",
    color: colors.white,
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "700",
    padding: "14px 28px",
    textDecoration: "none",
  } as React.CSSProperties,

  buttonSection: {
    margin: "24px 0",
  } as React.CSSProperties,

  callout: {
    backgroundColor: colors.amberLight,
    border: `1px solid #FDE68A`,
    borderRadius: "12px",
    padding: "16px 20px",
    margin: "20px 0",
  } as React.CSSProperties,

  calloutText: {
    color: "#92400E",
    fontSize: "14px",
    fontWeight: "600",
    margin: 0,
  } as React.CSSProperties,

  calloutBody: {
    color: "#92400E",
    fontSize: "14px",
    margin: "6px 0 0",
  } as React.CSSProperties,

  footer: {
    backgroundColor: "#F8FAFC",
    borderTop: "1px solid #E2E8F0",
    padding: "20px 32px",
  } as React.CSSProperties,

  footerText: {
    color: colors.gray400,
    fontSize: "12px",
    margin: 0,
    textAlign: "center" as const,
  } as React.CSSProperties,

  footerLink: {
    color: colors.gray400,
  } as React.CSSProperties,

  hr: {
    borderColor: "#E2E8F0",
    margin: "24px 0",
  } as React.CSSProperties,

  stat: {
    backgroundColor: colors.gray100,
    borderRadius: "10px",
    display: "inline-block",
    margin: "4px",
    padding: "10px 16px",
    textAlign: "center" as const,
    verticalAlign: "top",
  } as React.CSSProperties,

  statValue: {
    color: colors.gray900,
    fontSize: "20px",
    fontWeight: "700",
    display: "block",
  } as React.CSSProperties,

  statLabel: {
    color: colors.gray400,
    fontSize: "11px",
    display: "block",
  } as React.CSSProperties,
};

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
  userId: string;
  emailType: string;
  unsubscribeToken: string;
}

export function EmailLayout({
  preview,
  children,
  userId,
  emailType,
  unsubscribeToken,
}: EmailLayoutProps) {
  const unsubUrl = `${APP_URL}/api/email/unsubscribe?userId=${userId}&type=${emailType}&token=${unsubscribeToken}`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Amber header */}
          <Section style={styles.header}>
            <Text style={styles.logoText}>BlockBoost</Text>
          </Section>

          {/* Main content */}
          {children}

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              BlockBoost · AI Visibility for Local Businesses
              <br />
              <Link href={`${APP_URL}/dashboard`} style={styles.footerLink}>
                Open dashboard
              </Link>
              {" · "}
              <Link href={`${APP_URL}/dashboard/settings?tab=emails`} style={styles.footerLink}>
                Email preferences
              </Link>
              {" · "}
              <Link href={unsubUrl} style={styles.footerLink}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
