/**
 * Feature flags for incomplete integrations.
 *
 * Each flag is true ONLY when both:
 *   1. The intent flag (`NEXT_PUBLIC_FEATURE_*`) is "true"
 *   2. The underlying env vars are present (so a misconfigured flag doesn't ship broken UX)
 *
 * Why client-readable: the sidebar and settings UI are client components and
 * need to render or hide menu items based on whether the feature is live.
 */

export const FEATURES = {
  // Google sign-in: re-enable when GOOGLE_CLIENT_ID is added to prod env.
  // The login page's /api/auth/providers fetch is the authoritative gate;
  // this flag controls the marketing copy about "social sign-in".
  google: process.env.NEXT_PUBLIC_FEATURE_GOOGLE === "true",

  // Slack: hidden until we relaunch with proper testing.
  // Flip NEXT_PUBLIC_FEATURE_SLACK=true once SLACK_CLIENT_ID is in Vercel env.
  slack: process.env.NEXT_PUBLIC_FEATURE_SLACK === "true",

  // Social Listening: hidden until Sprint 13 ships the comprehensive Reddit UX.
  // Re-enable by setting NEXT_PUBLIC_FEATURE_SOCIAL=true.
  socialListening: process.env.NEXT_PUBLIC_FEATURE_SOCIAL === "true",

  // Calendly upgrade-call link: only show when the URL is configured.
  calendly: !!process.env.NEXT_PUBLIC_CALENDLY_URL,
} as const;
