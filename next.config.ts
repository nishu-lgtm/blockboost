import type { NextConfig } from "next";

// Security headers applied to every response. Best practices for SaaS:
//   - Content-Security-Policy: prevents stored-XSS exfiltration
//   - X-Frame-Options: prevents clickjacking
//   - Strict-Transport-Security: forces HTTPS (Vercel sets this too, belt-and-braces)
//   - Referrer-Policy: limits leaked referrer to third parties
//   - X-Content-Type-Options: prevents MIME sniffing
//   - Permissions-Policy: disables sensors we don't use
// Content Security Policy. Notes on choices:
//   - 'unsafe-inline' on script-src: Next.js inlines bootstrap scripts at build
//     time. We accept this until we wire CSP nonces (Next has a known XSS CVE
//     for nonce mode; safer to wait).
//   - 'unsafe-eval' on script-src: required by Next dev mode + some 3rd-party libs.
//   - challenges.cloudflare.com: Turnstile captcha.
//   - vercel.live: Vercel analytics/preview overlay.
//   - https://*.vercel-storage.com: Blob storage for PDF reports.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://vercel.live https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.openai.com https://api.resend.com https://vercel.live https://*.supabase.co wss://*.supabase.co https://api.apify.com https://www.googleapis.com",
  "frame-src 'self' https://challenges.cloudflare.com https://calendly.com https://vercel.live",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/auth/register",
        destination: "/auth/signup",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
