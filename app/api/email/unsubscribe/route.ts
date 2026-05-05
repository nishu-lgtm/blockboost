import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/email-renderer";

const PREF_MAP: Record<string, string> = {
  tips: "emailPrefTips",
  weeklyReport: "emailPrefWeeklyReport",
  monthlySummary: "emailPrefMonthlySummary",
  alerts: "emailPrefAlerts",
  featureNews: "emailPrefFeatureNews",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? "";
  const type = searchParams.get("type") ?? "";
  const token = searchParams.get("token") ?? "";

  if (!userId || !token) {
    return new NextResponse("Invalid unsubscribe link", { status: 400 });
  }

  if (!verifyUnsubscribeToken(userId, token)) {
    return new NextResponse("Invalid or expired unsubscribe link", { status: 403 });
  }

  const prefKey = PREF_MAP[type];

  if (prefKey) {
    // Unsubscribe from specific type
    await prisma.user.update({
      where: { id: userId },
      data: { [prefKey]: false },
    });
  } else if (type === "all") {
    // Unsubscribe from all non-billing emails
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailPrefTips: false,
        emailPrefWeeklyReport: false,
        emailPrefMonthlySummary: false,
        emailPrefAlerts: false,
        emailPrefFeatureNews: false,
      },
    });
  } else {
    return new NextResponse("Unknown email type", { status: 400 });
  }

  // Redirect to a confirmation page
  const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";
  const label = type === "all" ? "all marketing emails" : type;
  const url = `${APP_URL}/unsubscribed?type=${encodeURIComponent(label)}`;
  return NextResponse.redirect(url, { status: 302 });
}
