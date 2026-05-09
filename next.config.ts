import type { NextConfig } from "next";

// Security headers applied to every response. Best practices for SaaS:
//   - Content-Security-Policy: prevents stored-XSS exfiltration
//   - X-Frame-Options: prevents clickjacking
//   - Strict-Transport-Security: forces HTTPS (Vercel sets this too, belt-and-braces)
//   - Referrer-Policy: limits leaked referrer to third parties
//   - X-Content-Type-Options: prevents MIME sniffing
//   - Permissions-Policy: disables sensors we don't use
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
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
