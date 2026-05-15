/**
 * Edge-compatible NextAuth config — no Prisma, no Node.js-only modules.
 * Used by middleware.ts (Edge Runtime) only.
 * Full config (with Prisma adapter + events) lives in lib/auth.ts.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  // 7-day max age with daily sliding renewal. NextAuth default is 30d which
  // is too long for a B2B SaaS holding marketing data — compromised laptops
  // stay signed in for a month. 7d + sliding gives active users a transparent
  // experience while bounding the blast radius of stolen sessions.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as { adminRole?: string }).adminRole = token.adminRole as string;
        (session.user as { totpEnabled?: boolean }).totpEnabled = token.totpEnabled as boolean;
      }
      return session;
    },
  },
};
