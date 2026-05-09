import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

// Only register Google as a provider when credentials are actually configured.
// Without this guard, clicking "Continue with Google" with empty env vars
// triggers a NextAuth Configuration error (302 → /auth/error?error=Configuration)
// which is what users see as "There is a problem with the server configuration."
const googleProviders = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    ]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...googleProviders,
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Rate limit: 10 failed attempts per IP+email per 15 min.
        // Throws on the 11th — NextAuth will surface this as a sign-in error.
        const { rateLimit, clientIp } = await import("@/lib/rate-limit");
        const ip =
          req && "headers" in req && req.headers
            ? clientIp(req as unknown as Request)
            : "unknown";
        const email = String(credentials.email).toLowerCase();
        const limited = rateLimit(`login:${ip}:${email}`, 10, 15 * 60 * 1000);
        if (!limited.ok) {
          console.warn(`[auth] Rate-limited login attempt ip=${ip} email=${email}`);
          // Returning null gives a generic "invalid credentials" — better
          // than throwing because we don't want to leak that an account exists.
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      // OAuth signup — fire the email activation sequence
      if (user.id) {
        // Set trial end date if not already set
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { trialEndsAt: true },
        });
        if (dbUser && !dbUser.trialEndsAt) {
          await prisma.user.update({
            where: { id: user.id },
            data: { trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
          });
        }
        import("@/lib/email-triggers").then(({ onUserSignup }) =>
          onUserSignup(user.id!).catch((e) =>
            console.error("[auth] onUserSignup failed:", e)
          )
        );
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        // Fetch admin fields on first sign in
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { adminRole: true, totpEnabled: true },
        });
        token.adminRole = dbUser?.adminRole ?? "NONE";
        token.totpEnabled = dbUser?.totpEnabled ?? false;
      }
      // Re-fetch on explicit session update (e.g. after role change)
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { adminRole: true, totpEnabled: true },
        });
        if (dbUser) {
          token.adminRole = dbUser.adminRole;
          token.totpEnabled = dbUser.totpEnabled;
        }
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
});
