import Link from "next/link";
import {
  Zap,
  Search,
  Bot,
  TrendingUp,
  Stethoscope,
  Scale,
  Wrench,
  UtensilsCrossed,
  Dumbbell,
  Home,
  X,
  Star,
} from "lucide-react";
import { MobileNav } from "@/components/landing/MobileNav";
import { HeroDashboard } from "@/components/landing/HeroDashboard";
import { FeatureTabs } from "@/components/landing/FeatureTabs";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { label: "Product", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Blog", href: "#" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      {/* ── NAV ────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5">
            <Zap className="w-5 h-5 text-amber-500" />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-gray-900">Block</span>
              <span className="text-amber-500">Boost</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/auth/register"
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Start free trial
            </Link>
          </div>

          {/* Mobile hamburger */}
          <MobileNav />
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[var(--bb-orange-light)] text-amber-700 text-sm font-semibold px-4 py-2 rounded-full mb-8 border border-[var(--bb-orange-border)]">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            AI search is changing everything
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-6">
            Find out if AI recommends<br className="hidden sm:block" />
            <span className="text-amber-500"> your business</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-gray-500 max-w-lg mx-auto leading-relaxed mb-10">
            BlockBoost tracks whether ChatGPT, Google AI, and Perplexity mention
            your business when customers search. Know where you stand. Show up more.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-8 py-4 text-base font-bold transition-colors shadow-sm shadow-amber-200"
            >
              Start free — no card needed
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto border border-amber-400 text-amber-600 hover:bg-[var(--bb-orange-light)] rounded-xl px-8 py-4 text-base font-semibold transition-colors"
            >
              See how it works ↓
            </a>
          </div>

          {/* Social proof */}
          <p className="text-sm text-gray-400">
            Joined by 2,000+ local businesses · Dentists, lawyers, restaurants, contractors
          </p>
        </div>

        {/* Dashboard mockup */}
        <div className="max-w-3xl mx-auto mt-16 relative">
          {/* Amber glow */}
          <div
            className="absolute inset-0 -z-10 rounded-3xl opacity-40 blur-3xl"
            style={{ backgroundColor: "#FEF3C7" }}
          />
          <HeroDashboard />
        </div>
      </section>

      {/* ── SOCIAL PROOF LOGOS ─────────────────────────────────────── */}
      <section className="bg-[var(--bb-gray-50)] py-14 px-6 border-y border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-8">
            Trusted by local businesses across
          </p>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { icon: Stethoscope, label: "Dental Practices" },
              { icon: Scale, label: "Law Firms" },
              { icon: Wrench, label: "Contractors" },
              { icon: UtensilsCrossed, label: "Restaurants" },
              { icon: Dumbbell, label: "Gyms" },
              { icon: Home, label: "Real Estate" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gray-500" />
                </div>
                <span className="text-xs font-medium text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <div>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">
              THE PROBLEM
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mt-4 mb-6 leading-tight">
              Your customers are asking AI where to go. Are you showing up?
            </h2>
            <div className="space-y-4 text-gray-500 text-lg leading-relaxed">
              <p>
                When someone types &ldquo;best dentist near me&rdquo; into ChatGPT or asks
                Google&apos;s AI — they get a direct answer. No scrolling through websites.
                Just a recommendation.
              </p>
              <p>
                If your business isn&apos;t in that answer, that customer goes to your
                competitor. And you never even knew they were looking.
              </p>
              <p className="font-medium text-gray-700">
                BlockBoost tells you exactly when you&apos;re missing out — and what to do
                about it.
              </p>
            </div>
          </div>

          {/* Right: illustration */}
          <div className="relative space-y-3">
            {/* Chat bubble */}
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-5 py-4 max-w-sm">
              <p className="text-sm font-medium text-gray-700">
                &ldquo;Who&apos;s the best plumber in Austin?&rdquo;
              </p>
            </div>

            {/* AI response */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 max-w-sm shadow-sm ml-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                AI Response
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-green-500 font-bold text-lg">✓</span>
                  <span className="text-sm font-semibold text-gray-800">Rival Plumbing Co.</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-500 font-bold text-lg">✓</span>
                  <span className="text-sm font-semibold text-gray-800">Austin Pro Plumbers</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-amber-400 font-bold text-lg">?</span>
                  <div>
                    <span className="text-sm font-semibold text-amber-700">Your Business</span>
                    <p className="text-xs text-amber-600">Is this you? It could be.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">
              HOW IT WORKS
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mt-4">
              Set up in 5 minutes. Results today.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: "1",
                icon: Search,
                title: "Tell us your business",
                body: "Enter your business name, website, and what city you're in. That's it.",
              },
              {
                num: "2",
                icon: Bot,
                title: "We scan the AI platforms",
                body: "BlockBoost checks ChatGPT, Google AI, Perplexity, and more to see if they mention you.",
              },
              {
                num: "3",
                icon: TrendingUp,
                title: "See your score & fix it",
                body: "Get your AI Visibility Score and a plain-English action plan to show up more.",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="bg-[var(--bb-gray-50)] rounded-2xl p-8 border border-gray-100"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">{step.num}</span>
                  </div>
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a
              href="/report/demo"
              className="text-amber-600 font-semibold hover:text-amber-700 transition-colors"
            >
              See a sample report →
            </a>
          </div>
        </div>
      </section>

      {/* ── FEATURES (tabbed) ──────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">
              Everything you need to win in AI search
            </h2>
            <p className="text-lg text-gray-500">Built for business owners, not SEO experts</p>
          </div>
          <FeatureTabs />
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────── */}
      <PricingSection />

      {/* ── TESTIMONIALS ───────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">
              WHAT CUSTOMERS SAY
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mt-4">Real businesses. Real results.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  "I had no idea ChatGPT wasn't recommending my practice. BlockBoost showed me the problem and told me exactly how to fix it. Worth every penny.",
                name: "Dr. Sarah M.",
                biz: "Dentist, Austin TX",
                initials: "SM",
              },
              {
                quote:
                  "My competitor was showing up in every AI search and I wasn't. Within 3 weeks of using BlockBoost I started appearing. My calls went up 40%.",
                name: "James T.",
                biz: "Personal Injury Lawyer, Chicago",
                initials: "JT",
              },
              {
                quote:
                  "The reports are so easy to understand. I send them to my team every month. No jargon, just clear numbers and what to do next.",
                name: "Maria G.",
                biz: "Restaurant Owner, Miami",
                initials: "MG",
              },
            ].map((t) => (
              <div key={t.initials} className="bg-[var(--bb-gray-50)] rounded-2xl p-8">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-amber-700">{t.initials}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.biz}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <FaqSection />

      {/* ── FINAL CTA ──────────────────────────────────────────────── */}
      <section className="bg-amber-500 py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-white leading-tight mb-4">
            Find out if AI is recommending
            <br />
            your business — today
          </h2>
          <p className="text-xl text-amber-100 mb-10">
            Takes 5 minutes. No credit card. Free for 14 days.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-white text-amber-600 hover:bg-amber-50 rounded-xl px-10 py-4 text-lg font-bold transition-colors shadow-sm"
          >
            Check my AI visibility →
          </Link>
          <p className="text-amber-200 text-sm mt-6">
            Join 2,000+ businesses already using BlockBoost
          </p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-white py-16 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-1.5 mb-3">
              <Zap className="w-5 h-5 text-amber-400" />
              <span className="text-xl font-bold">
                <span className="text-white">Block</span>
                <span className="text-amber-400">Boost</span>
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">
              AI visibility for local businesses
            </p>
            <div className="flex gap-4">
              {[
                { Icon: X, label: "X (Twitter)" },
                {
                  label: "LinkedIn",
                  svg: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                      <rect x="2" y="9" width="4" height="12" />
                      <circle cx="4" cy="4" r="2" />
                    </svg>
                  ),
                },
                {
                  label: "YouTube",
                  svg: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
                      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" />
                    </svg>
                  ),
                },
              ].map(({ Icon, svg, label }, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label={label}
                  className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  {Icon ? <Icon className="w-4 h-4" /> : svg}
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
              Product
            </p>
            <ul className="space-y-3">
              {["Features", "Pricing", "FAQ"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
              Company
            </p>
            <ul className="space-y-3">
              {["About", "Blog", "Careers", "Press", "Contact"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
              Legal
            </p>
            <ul className="space-y-3">
              {["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-sm text-gray-500">© 2026 BlockBoost. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
