"use client";

import { useState } from "react";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  emailVerified: boolean;
}

/**
 * Sticky banner shown at the top of authenticated pages when the user
 * hasn't yet clicked the verification link in their email.
 *
 * Dismissible per-session (sessionStorage) so it doesn't nag during a
 * single working session, but reappears on next visit until verified.
 */
export function EmailVerificationBanner({ emailVerified }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("email-banner-dismissed") === "1";
  });
  const [resending, setResending] = useState(false);

  if (emailVerified || dismissed) return null;

  async function handleResend() {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Verification email sent. Check your inbox.");
      } else {
        toast.error(data.error ?? "Couldn't send email. Try again later.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  }

  function handleDismiss() {
    sessionStorage.setItem("email-banner-dismissed", "1");
    setDismissed(true);
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Mail className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-900 truncate">
          <strong>Please verify your email.</strong>{" "}
          We sent a confirmation link when you signed up.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleResend}
          disabled={resending}
          className="text-xs font-semibold text-amber-700 hover:text-amber-900 disabled:opacity-50 underline"
        >
          {resending ? "Sending…" : "Resend"}
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-amber-600 hover:text-amber-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
