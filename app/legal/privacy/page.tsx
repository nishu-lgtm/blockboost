import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export const metadata = {
  title: "Privacy Policy — BlockBoost",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <BrandLogo size="md" />
          </Link>
          <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-amber-600">
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <article className="prose prose-slate max-w-none">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: November 8, 2025</p>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">1. Information We Collect</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              We collect information you provide directly: name, email, billing details, business
              data (brand name, competitors, prompts) and any integrations you connect (Google
              Search Console, Slack). We also collect usage telemetry to improve the Service.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">2. How We Use Information</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              We use your data to operate the Service: running AI visibility scans on your behalf,
              generating reports, sending email summaries, and providing support. We do not sell
              your data to third parties.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">3. Sharing of Information</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              We share data only with subprocessors required to deliver the Service: Supabase
              (database hosting), Vercel (web hosting), Resend (email delivery), OpenAI (AI
              generation), and Apify (web scraping). All subprocessors are bound by data
              processing agreements.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">4. Cookies &amp; Analytics</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              We use essential cookies to keep you logged in. We do not use third-party advertising
              cookies.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">5. Data Retention</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              We retain your data for the duration of your account. On account deletion, all
              personal data is erased within 30 days, except as required for legal or accounting
              purposes.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">6. Your Rights</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              You may access, correct, or delete your personal data at any time via Settings or by
              emailing us. EU and UK users have rights under GDPR; California users have rights
              under CCPA.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">7. Security</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              We use industry-standard encryption (TLS in transit, encryption at rest) to protect
              your data. No system is fully secure, but we work hard to keep it that way.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">8. Contact</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              Privacy questions or requests? Email{" "}
              <a href="mailto:privacy@blockboost.co" className="text-indigo-600 hover:underline">
                privacy@blockboost.co
              </a>
              .
            </p>
          </section>

          <p className="text-xs text-slate-400 mt-12 pt-6 border-t border-slate-200">
            See also our{" "}
            <Link href="/legal/terms" className="text-indigo-600 hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </article>
      </main>
    </div>
  );
}
