// Force dynamic rendering on every auth page request so cached HTML can't
// serve a stale provider list (e.g. the Google sign-in button from before
// 84383ec was deployed). The login/signup pages still check
// /api/auth/providers at runtime, but this guarantees the initial server
// render reflects current provider configuration too.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
