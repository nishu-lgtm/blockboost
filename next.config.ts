import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy URL — landing CTAs used to point here. 308 keeps the method
      // and tells search engines/clients the move is permanent. Belt-and-
      // braces in case anyone has a cached HTML, bookmark, or stale link.
      {
        source: "/auth/register",
        destination: "/auth/signup",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
