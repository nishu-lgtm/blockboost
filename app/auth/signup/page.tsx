"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordPolicyHints } from "@/components/auth/password-policy-hints";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { toast } from "sonner";

const TURNSTILE_SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "";

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [accountExistsEmail, setAccountExistsEmail] = useState<string | null>(null);
  // Sticky inline error — toast.error is transient (4s) and easy to miss,
  // which left users believing signup succeeded when it actually 4xx'd.
  const [signupError, setSignupError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  // Hide "Continue with Google" if the provider isn't registered server-side.
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

    if (TURNSTILE_SITEKEY && !turnstileToken) {
      toast.error("Please complete the human-verification challenge.");
      return;
    }

    setIsLoading(true);
    setAccountExistsEmail(null);
    setSignupError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, turnstileToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setAccountExistsEmail(formData.email);
          return;
        }
        setSignupError(data.error || "Registration failed. Please try again.");
        return;
      }

      toast.success(
        "Account created. Please check your inbox to verify your email."
      );

      // Auto sign-in after registration
      const signInResult = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push("/auth/login");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setSignupError("Network error — please check your connection and try again.");
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
          <h2 className="text-3xl font-bold text-white mb-8">
            Start knowing where your brand shows up in AI
          </h2>
          <ul className="space-y-4">
            {[
              "Monitor ChatGPT, Perplexity & Google AI Overviews",
              "Track citations and AI share of voice",
              "Get content briefs to improve your AI visibility",
              "Set up in under 5 minutes",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-slate-300">
                <CheckCircle2 className="h-5 w-5 text-amber-400 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-4 text-slate-500 text-sm">
          <span>14-day free trial</span>
          <span>·</span>
          <span>No credit card required</span>
          <span>·</span>
          <span>Cancel anytime</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <BrandLogo size="lg" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Create your account</h1>
            <p className="text-slate-500">Start your 14-day free trial. No credit card required.</p>
          </div>

          {signupError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                <span className="text-red-600 text-xs font-bold">!</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-900 mb-0.5">Signup failed</p>
                <p className="text-sm text-red-700">{signupError}</p>
              </div>
              <button
                type="button"
                onClick={() => setSignupError(null)}
                className="text-red-500 hover:text-red-700 text-xs"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          {accountExistsEmail && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-sm font-bold text-amber-900 mb-1">
                You already have an account
              </h2>
              <p className="text-sm text-amber-800 mb-4">
                We found an existing BlockBoost account for{" "}
                <strong>{accountExistsEmail}</strong>. Please sign in to continue.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/auth/login?email=${encodeURIComponent(accountExistsEmail)}`}
                  className="flex-1"
                >
                  <Button className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-white">
                    Sign in instead
                  </Button>
                </Link>
                <Link
                  href={`/auth/forgot-password?email=${encodeURIComponent(accountExistsEmail)}`}
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full h-10 border-amber-300 text-amber-700 hover:bg-amber-100">
                    Forgot password?
                  </Button>
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setAccountExistsEmail(null)}
                className="mt-3 text-xs text-amber-700 hover:text-amber-900 underline"
              >
                Use a different email
              </button>
            </div>
          )}

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-slate-700">
                Full name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                required
                className="h-11 border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700">
                Work email
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
              <Label htmlFor="password" className="text-slate-700">
                Password
              </Label>
              <PasswordInput
                id="password"
                placeholder="Pick a strong password you'll remember"
                value={formData.password}
                onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={10}
                autoComplete="new-password"
                className="h-11 border-slate-300"
              />
              <PasswordPolicyHints password={formData.password} />
            </div>

            {TURNSTILE_SITEKEY && (
              <TurnstileWidget
                sitekey={TURNSTILE_SITEKEY}
                onToken={setTurnstileToken}
              />
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white mt-2"
              disabled={isLoading || (Boolean(TURNSTILE_SITEKEY) && !turnstileToken)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create free account"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            By creating an account, you agree to our{" "}
            <Link href="/legal/terms" className="text-indigo-600 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-indigo-600 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-amber-600 font-medium hover:text-amber-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
