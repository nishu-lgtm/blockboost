import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";

export const metadata = {
  title: "Verify your email — BlockBoost",
};

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { status } = await searchParams;

  const config: Record<
    string,
    { icon: React.ReactNode; title: string; body: string; cta: { label: string; href: string } }
  > = {
    success: {
      icon: <CheckCircle2 className="h-8 w-8 text-green-600" />,
      title: "Email verified",
      body:
        "Your email is confirmed. Welcome to BlockBoost — your AI visibility data is ready.",
      cta: { label: "Go to dashboard", href: "/dashboard" },
    },
    expired: {
      icon: <AlertCircle className="h-8 w-8 text-amber-600" />,
      title: "Link expired",
      body:
        "This verification link is older than 7 days. Sign in and click 'Resend verification email' from the banner to get a new one.",
      cta: { label: "Sign in", href: "/auth/login" },
    },
    invalid: {
      icon: <AlertCircle className="h-8 w-8 text-red-600" />,
      title: "Invalid link",
      body:
        "We couldn't verify that token. It may have been edited in the URL. Try clicking the link from your inbox again.",
      cta: { label: "Go to homepage", href: "/" },
    },
    pending: {
      icon: <Mail className="h-8 w-8 text-amber-600" />,
      title: "Check your inbox",
      body:
        "We just sent a verification link to the email you signed up with. Click it to confirm your address and unlock all features.",
      cta: { label: "Sign in", href: "/auth/login" },
    },
  };

  const c = config[status ?? "pending"] ?? config.pending;

  return (
    <Suspense>
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8">
        <Link href="/" className="mb-10">
          <BrandLogo size="lg" />
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 max-w-md w-full text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-amber-50 rounded-full mx-auto mb-6">
            {c.icon}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">{c.title}</h1>
          <p className="text-slate-600 leading-relaxed mb-8">{c.body}</p>
          <Link href={c.cta.href}>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white w-full">
              {c.cta.label}
            </Button>
          </Link>
        </div>
      </div>
    </Suspense>
  );
}
