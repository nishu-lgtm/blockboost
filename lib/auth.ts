import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
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
