/**
 * Strip secrets from error objects before logging. Crucially never include
 * the OpenAI SDK error's `request` headers (which contain the bearer token)
 * or DB connection strings (with passwords).
 *
 * Vercel runtime logs persist for ~7-30 days; an attacker who exfiltrates
 * logs should not be able to recover credentials.
 */

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // OpenAI keys
  [/sk-[A-Za-z0-9_-]{20,}/g, "sk-***REDACTED***"],
  [/sk-svcacct-[A-Za-z0-9_-]{20,}/g, "sk-svcacct-***REDACTED***"],
  // Resend API keys
  [/\bre_[A-Za-z0-9_-]{20,}/g, "re_***REDACTED***"],
  // Apify tokens
  [/\bapify_api_[A-Za-z0-9_-]+/g, "apify_api_***REDACTED***"],
  // Vercel Blob tokens
  [/\bvercel_blob_(?:rw_|ro_)?[A-Za-z0-9_-]+/g, "vercel_blob_***REDACTED***"],
  // Postgres connection strings (with password)
  [/postgres(?:ql)?:\/\/[^@\s]+@/g, "postgres://***REDACTED***@"],
  // Supabase publishable keys (less sensitive but still)
  [/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, "sb_***REDACTED***"],
  // Bearer tokens generally
  [/Bearer\s+[A-Za-z0-9._-]{20,}/g, "Bearer ***REDACTED***"],
  // GitHub tokens
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]+/g, "gh***_REDACTED***"],
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const [re, replacement] of SECRET_PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}

/**
 * Format an error for safe logging — message + redacted stack only, no
 * request body / response headers / SDK internals.
 */
export function formatSafeError(err: unknown): {
  message: string;
  stack?: string;
} {
  if (err instanceof Error) {
    return {
      message: redactSecrets(err.message),
      stack: err.stack ? redactSecrets(err.stack) : undefined,
    };
  }
  return { message: redactSecrets(String(err)) };
}

/** Log an error safely. Replaces `console.error(err)` everywhere. */
export function logSafeError(prefix: string, err: unknown): void {
  const safe = formatSafeError(err);
  console.error(prefix, safe.message);
  if (safe.stack) console.error(safe.stack);
}
