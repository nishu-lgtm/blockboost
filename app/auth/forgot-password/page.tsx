"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

function ForgotPasswordInner() {
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(prefilledEmail);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-block mb-8">
          <BrandLogo size="md" />
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          {submitted ? (
            <>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Check your inbox</h1>
              <p className="text-sm text-slate-500 mb-6">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
                The link expires in 1 hour.
              </p>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to login
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Forgot your password?</h1>
              <p className="text-sm text-slate-500 mb-6">
                Enter your email and we&apos;ll send you a link to reset it.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="you@example.com"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Send reset link
                </button>
              </form>
              <Link
                href="/auth/login"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
