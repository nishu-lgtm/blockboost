/**
 * Password validation policy for signup + reset-password.
 *
 * Rules:
 *  - Minimum 10 characters
 *  - Must contain at least one letter
 *  - Must contain at least one number
 *  - Cannot be in the top-N common-password blocklist (case-insensitive)
 *
 * The common-password list is intentionally small (~50 most-leaked passwords).
 * For stronger protection, swap to the full SecLists rockyou top-100k.
 */

const MIN_LENGTH = 10;

// Top common passwords from 2024 leak databases. Keep small + memory-friendly.
const COMMON_BLOCKLIST = new Set<string>(
  [
    "123456",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty",
    "qwerty123",
    "qwertyuiop",
    "password",
    "password1",
    "password123",
    "passw0rd",
    "p@ssword",
    "admin",
    "admin123",
    "letmein",
    "welcome",
    "welcome1",
    "iloveyou",
    "monkey",
    "dragon",
    "abc123",
    "abcd1234",
    "111111",
    "1111111",
    "11111111",
    "000000",
    "00000000",
    "999999",
    "654321",
    "987654321",
    "asdf1234",
    "asdfghjkl",
    "zxcvbnm",
    "qazwsx",
    "trustno1",
    "sunshine",
    "princess",
    "football",
    "baseball",
    "michael",
    "shadow",
    "master",
    "jennifer",
    "freedom",
    "starwars",
    "superman",
    "batman",
    "computer",
    "internet",
    "samsung",
    "iphone",
    "google",
    "facebook",
    "letmein123",
    "blockboost",
    "blockboost1",
    "blockboost123",
  ].map((p) => p.toLowerCase())
);

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validatePassword(password: string): ValidationResult {
  if (typeof password !== "string") {
    return { ok: false, error: "Password is required." };
  }
  if (password.length < MIN_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_LENGTH} characters.`,
    };
  }
  // Reject implausibly long passwords (DoS protection — bcrypt truncates at 72b)
  if (password.length > 200) {
    return { ok: false, error: "Password is too long (max 200 characters)." };
  }
  if (!/[A-Za-z]/.test(password)) {
    return {
      ok: false,
      error: "Password must contain at least one letter.",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      ok: false,
      error: "Password must contain at least one number.",
    };
  }
  if (COMMON_BLOCKLIST.has(password.toLowerCase())) {
    return {
      ok: false,
      error: "This password is too common. Please choose a stronger one.",
    };
  }
  return { ok: true };
}

// Per-rule status for live UI feedback. Each rule becomes a row in the
// signup form's policy hint card so users see exactly what's failing
// instead of getting one error after submit.
export interface PasswordChecks {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  notCommon: boolean;
}

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= MIN_LENGTH,
    hasLetter: /[A-Za-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    // Only mark "not common" once they've typed something — empty string
    // shouldn't show a green check before the user has started.
    notCommon: password.length > 0 && !COMMON_BLOCKLIST.has(password.toLowerCase()),
  };
}

export const PASSWORD_MIN_LENGTH = MIN_LENGTH;
