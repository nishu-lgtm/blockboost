"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get("email") ?? "";
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({ email: prefilledEmail, password: "" });
  const [googleEnabled, setGoogleEnabled] = useState(false);
  // Sticky inline error — replaces the transient toast that left users
  // with a vague "Something went wrong" message they couldn't act on.
  const [loginError, setLoginError] = useState<string | null>(null);

  // Informational banner from query params (e.g. ?msg=signup-success-please-sign-in
  // after auto-signIn fails during signup, or ?msg=google-unavailable when the
  // middleware intercepts a stale Google sign-in link).
  const msg = searchParams.get("msg");
  const infoBanner: string | null =
    msg === "signup-success-please-sign-in"
      ? "Your account was created. Please sign in with your email and password to continue."
      : msg === "google-unavailable"
      ? "Google sign-in isn't available right now. Sign in with your email and password instead."
      : null;

  // Only show "Continue with Google" if the provider is actually registered
  // server-side. Without this, clicking the button when GOOGLE_CLIENT_ID
  // isn't set produces a NextAuth Configuration error.
  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((providers: Record<string, unknown>) => {
        setGoogleEnabled("google" in providers);
      })
      .catch(() => setGoogleEnabled(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      // result.error returns one of: "CredentialsSignin", "Configuration",
      // or a generic message. Surface them differently so users get an
      // actionable hint instead of "something went wrong" for everything.
      if (result?.error) {
        if (result.error === "CredentialsSignin" || result.error === "CredentialsSignin&code=credentials") {
          setLoginError("Wrong email or password. Double-check both and try again.");
        } else if (result.error === "Configuration") {
          setLoginError(
            "Sign-in is temporarily unavailable. Try refreshing the page or contact support."
          );
        } else {
          // Show the raw error code so support can debug rare cases
          setLoginError(`Sign-in failed (${result.error}). Refresh and try again.`);
        }
      } else if (result?.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        // No error AND no ok — uncommon but happens if NextAuth's response
        // is malformed (CSP issue, network glitch). Tell user to refresh.
        setLoginError(
          "Couldn't complete sign-in — please refresh the page and try again."
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoginError(`Network error: ${msg.slice(0, 120)}. Check your connection.`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      toast.error("Google sign-in failed. Please try again.");
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 flex-col justify-between p-12">
        <Link href="/">
          <BrandLogo variant="dark" size="lg" />
        </Link>

        <div>
          <blockquote className="text-white">
            <p className="text-2xl font-medium leading-relaxed mb-6">
              "BlockBoost transformed how we think about AI search. We went from invisible to
              being cited in 68% of relevant ChatGPT responses in just 90 days."
            </p>
            <footer>
              <p className="font-semibold">Sarah Chen</p>
              <p className="text-amber-200 text-sm">Head of Marketing, NexaCloud</p>
            </footer>
          </blockquote>
        </div>

        <div className="flex items-center gap-4 text-amber-200 text-sm">
          <span>500+ brands trust BlockBoost</span>
          <span>·</span>
          <span>SOC 2 Type II certified</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <BrandLogo size="lg" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h1>
            <p className="text-slate-500">Sign in to your BlockBoost account</p>
          </div>

          {googleEnabled && (
            <>
              <Button
                variant="outline"
                className="w-full mb-6 h-11 border-slate-300 text-slate-700"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-slate-400">or continue with email</span>
                </div>
              </div>
            </>
          )}

          {infoBanner && !loginError && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                <span className="text-emerald-600 text-xs font-bold">✓</span>
              </div>
              <p className="text-sm text-emerald-800 flex-1">{infoBanner}</p>
            </div>
          )}

          {loginError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                <span className="text-red-600 text-xs font-bold">!</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-900 mb-0.5">Sign in failed</p>
                <p className="text-sm text-red-700">{loginError}</p>
              </div>
              <button
                type="button"
                onClick={() => setLoginError(null)}
                className="text-red-500 hover:text-red-700 text-xs"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                required
                className="h-11 border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700">
                  Password
                </Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                required
                autoComplete="current-password"
                className="h-11 border-slate-300"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-amber-600 font-medium hover:text-amber-700">
              Start your free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
