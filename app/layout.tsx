import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import AuthSessionProvider from "@/components/session-provider";

// U10 — system font stack. We no longer ship a webfont for the body —
// each OS uses its native UI font (San Francisco on Apple, Segoe on
// Windows). Geist_Mono is retained for code/snippet blocks only.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BlockBoost – AI Brand Monitoring Platform",
  description:
    "Know exactly when and where AI recommends your brand. Monitor citations across ChatGPT, Claude, Gemini, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthSessionProvider>
          {children}
          <Toaster />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
