import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { validatePassword } from "@/lib/password-policy";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendVerificationEmail } from "@/lib/email-verification";

const bodySchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Please enter a valid email address").max(254),
  password: z.string().min(1, "Password is required"),
  turnstileToken: z.string().optional(),
});

export async function POST(req: Request) {
  // Rate limit: max 5 signups per IP per 15 minutes
  const ip = clientIp(req);
  const limited = rateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many signup attempts. Try again in ${limited.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { name, email, password, turnstileToken } = parsed.data;

    // Cloudflare Turnstile (skipped if env not set)
    const captcha = await verifyTurnstile(turnstileToken, ip);
    if (!captcha.ok) {
      return NextResponse.json({ error: captcha.error }, { status: 400 });
    }

    // Strong password policy
    const policy = validatePassword(password);
    if (!policy.ok) {
      return NextResponse.json({ error: policy.error }, { status: 400 });
    }

    // Normalise email — lower-case so case-mismatched logins still work
    const normalisedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalisedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: normalisedEmail,
        password: hashedPassword,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        // emailVerified intentionally null — verified via the link we send below
      },
    });

    // Fire-and-forget: verification email + activation sequence.
    // Verification email is independent of the A1 welcome (different purpose).
    sendVerificationEmail({ to: normalisedEmail, name, userId: user.id }).catch(
      (e) => console.error("[register] sendVerificationEmail failed:", e)
    );

    import("@/lib/email-triggers").then(({ onUserSignup }) =>
      onUserSignup(user.id).catch((e) =>
        console.error("[register] onUserSignup failed:", e)
      )
    );

    return NextResponse.json(
      {
        message: "Account created. Please check your email to verify.",
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[register] error:", message, stack);
    // TEMPORARY DEBUG: include error message in response so we can diagnose
    // the production 500. Remove `detail` once root cause is fixed.
    return NextResponse.json(
      {
        error: "Something went wrong. Please try again.",
        detail: message,
      },
      { status: 500 }
    );
  }
}
