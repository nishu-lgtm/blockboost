/**
 * Edge-compatible NextAuth config — no Prisma, no Node.js-only modules.
 * Used by middleware.ts (Edge Runtime) only.
 * Full config (with Prisma adapter + events) lives in lib/auth.ts.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  providers: [], // providers are added in lib/auth.ts
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
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
