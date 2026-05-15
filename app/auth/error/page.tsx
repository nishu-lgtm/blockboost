"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, Mail } from "lucide-react";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";

// Each known error code gets a self-explaining card: title, what happened, what to do.
// Configuration is most often "an OAuth provider isn't set up yet" — surface that
// directly rather than the cryptic NextAuth default ("server configuration problem")
// that left users stranded with no next step.
interface ErrorInfo {
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
}

const ERROR_MAP: Record<string, ErrorInfo> = {
  Configuration: {
    title: "Sign-in method not available",
    body:
      "We can't sign you in with that method right now — typically because a social provider isn't configured. " +
      "You can sign in with email and password instead.",
    primaryHref: "/auth/login",
    primaryLabel: "Sign in with email",
  },
  AccessDenied: {
    title: "Access denied",
    body: "You don't have permission to sign in with that account.",
    primaryHref: "/auth/login",
    primaryLabel: "Try a different account",
  },
  Verification: {
    title: "Verification link expired",
    body:
      "This verification link has already been used or expired. " +
      "Sign in to request a fresh verification email.",
    primaryHref: "/auth/login",
    primaryLabel: "Sign in",
  },
  CredentialsSignin: {
    title: "Wrong email or password",
    body: "We couldn't find an account with those credentials. Double-check your email and try again.",
    primaryHref: "/auth/login",
    primaryLabel: "Try again",
  },
  Default: {
    title: "Sign-in failed",
    body: "Something went wrong while signing you in. Please try again.",
    primaryHref: "/auth/login",
    primaryLabel: "Back to sign in",
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") ?? "Default";
  const info = ERROR_MAP[errorCode] ?? ERROR_MAP.Default;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8">
      <div className="text-center max-w-md">
        <Link href="/" className="inline-block mb-10">
          <BrandLogo size="lg" />
        </Link>

        <div className="flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mx-auto mb-6">
          <AlertCircle className="h-8 w-8 text-amber-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-3">{info.title}</h1>
        <p className="text-slate-500 mb-8">{info.body}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <Link href={info.primaryHref}>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {info.primaryLabel}
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button variant="outline">Create an account</Button>
          </Link>
        </div>

        <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Mail className="h-3 w-3" />
          Still stuck? Email <a href="mailto:support@visibilityiq.com" className="underline hover:text-slate-600">support@visibilityiq.com</a>
        </p>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
