"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, BarChart3, CheckCircle } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordPolicyHints } from "@/components/auth/password-policy-hints";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to reset password");
      }
      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 mb-8 text-slate-700 hover:text-indigo-600 transition-colors">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg">BlockBoost</span>
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          {success ? (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Password updated</h1>
              <p className="text-sm text-slate-500">Redirecting you to login…</p>
            </div>
          ) : !token ? (
            <>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid reset link</h1>
              <p className="text-sm text-slate-500 mb-6">
                This link is missing a token. Please request a new password reset.
              </p>
              <Link
                href="/auth/forgot-password"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Request a new link →
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Set a new password</h1>
              <p className="text-sm text-slate-500 mb-6">Enter your new password below.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={10}
                    autoComplete="new-password"
                    placeholder="Pick a strong password you'll remember"
                  />
                  <PasswordPolicyHints password={newPassword} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                  />
                  {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                    <p className="mt-1 text-xs text-red-500">Passwords don&apos;t match</p>
                  )}
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Reset password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
