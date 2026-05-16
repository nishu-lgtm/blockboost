/**
 * Centralised fail-closed accessor for the HMAC keying material used by
 * password-reset, email-verification, and unsubscribe tokens.
 *
 * Before this module each token route had its own `process.env.X ?? ""`
 * fallback, which meant a misconfigured production env would silently issue
 * tokens signed with the empty string. Anyone who knew the token shape
 * could then forge them. (Audit finding 2026-05-16.)
 *
 * All token issuance/verification routes must call `requireTokenSecret()`
 * and surface a non-200 error if it throws.
 */

const MIN_SECRET_LENGTH = 32;

/**
 * Returns the token-signing secret, or throws if it's missing/too short.
 * Use in token-generating code paths — let the throw surface as a 500.
 */
export function requireTokenSecret(): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "EMAIL_UNSUBSCRIBE_SECRET is missing or too short (<32 chars). " +
        "Refusing to issue/validate tokens with weak keying material."
    );
  }
  return secret;
}

/**
 * Safe variant for token-VERIFYING code paths. Returns null on misconfig
 * so verify endpoints can treat it as "invalid token" and return 400/403
 * — same external behaviour as a bogus token, no information leak.
 */
export function getTokenSecretOrNull(): string | null {
  try {
    return requireTokenSecret();
  } catch {
    return null;
  }
}
