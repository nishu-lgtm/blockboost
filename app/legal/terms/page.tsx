import Link from "next/link";
import { BarChart3 } from "lucide-react";

export const metadata = {
  title: "Terms of Service — BlockBoost",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">BlockBoost</span>
          </Link>
          <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-indigo-600">
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <article className="prose prose-slate max-w-none">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: November 8, 2025</p>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">1. Acceptance of Terms</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              By accessing or using BlockBoost (&quot;the Service&quot;), you agree to be bound by these
              Terms of Service. If you do not agree, please do not use the Service.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">2. Description of Service</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              BlockBoost provides AI visibility monitoring, content briefs, social listening, and
              related analytics tools for businesses. Features available depend on your subscription
              plan.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">3. Account Terms</h2>
            <p className="text-slate-700 text-sm leading-relaxed mb-2">
              You are responsible for maintaining the security of your account and password. You may
              not use the Service for any illegal or unauthorized purpose.
            </p>
            <p className="text-slate-700 text-sm leading-relaxed">
              You must be at least 18 years old to use the Service. One person or legal entity may
              maintain no more than one free account.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">4. Subscription &amp; Billing</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              Paid plans are billed in advance on a monthly basis and are non-refundable except as
              required by law. You may cancel at any time; access continues until the end of the
              billing period.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">5. Acceptable Use</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              You agree not to abuse the Service, including by submitting automated requests beyond
              your plan limits, attempting unauthorized access, or using the Service to violate any
              third party&apos;s rights.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">6. Termination</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              We may suspend or terminate your access to the Service at any time, without notice,
              for conduct that we believe violates these Terms or is harmful to other users or to us.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">7. Disclaimer &amp; Limitation of Liability</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              The Service is provided &quot;as is&quot; without warranty of any kind. To the maximum
              extent permitted by law, BlockBoost disclaims all liability for indirect, incidental,
              or consequential damages.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">8. Changes</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              We may update these Terms from time to time. Material changes will be notified via
              email or in-app notice. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">9. Contact</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:hello@blockboost.co" className="text-indigo-600 hover:underline">
                hello@blockboost.co
              </a>
              .
            </p>
          </section>

          <p className="text-xs text-slate-400 mt-12 pt-6 border-t border-slate-200">
            See also our{" "}
            <Link href="/legal/privacy" className="text-indigo-600 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </article>
      </main>
    </div>
  );
}
