import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? "";
  const scoreStr = searchParams.get("score") ?? "";
  const score = parseInt(scoreStr, 10);

  if (!userId || isNaN(score) || score < 0 || score > 10) {
    return NextResponse.redirect(`${APP_URL}/dashboard`, { status: 302 });
  }

  // Store NPS response — we use AdminEmail table as a scratchpad
  // (In production you'd have a dedicated NPSResponse model)
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user) {
      // Log as admin notification for now
      const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
      if (adminEmail) {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "noreply@blockboost.co",
          to: adminEmail,
          subject: `NPS Response: ${score}/10 from ${user.email ?? userId}`,
          html: `<p>${user.name ?? user.email ?? userId} gave a score of <strong>${score}/10</strong>.</p>`,
        });
      }
    }
  } catch {
    // Best-effort
  }

  // Redirect to a thank-you page
  const redirect = score <= 6
    ? `${APP_URL}/nps-thanks?score=${score}&feedback=1`
    : `${APP_URL}/nps-thanks?score=${score}`;

  return NextResponse.redirect(redirect, { status: 302 });
}
