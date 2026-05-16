"use client";

import { Check, X } from "lucide-react";
import { getPasswordChecks } from "@/lib/password-policy";

/**
 * Live password policy checklist. Each rule shows a green check or grey X
 * as the user types, so they know exactly what's missing instead of hitting
 * "submit" and getting one error at a time.
 *
 * Hide entirely when the input is empty (cleaner first-impression).
 * Use on /auth/signup and /auth/reset-password — not on /auth/login since
 * the user is entering an existing password we don't validate against policy.
 */
export function PasswordPolicyHints({ password }: { password: string }) {
  if (password.length === 0) return null;

  const checks = getPasswordChecks(password);
  const rules: Array<[boolean, string]> = [
    [checks.minLength, "At least 10 characters"],
    [checks.hasLetter, "Contains a letter"],
    [checks.hasNumber, "Contains a number"],
    [checks.notCommon, "Not a common / leaked password"],
  ];

  return (
    <ul className="mt-2 space-y-1 text-xs">
      {rules.map(([passed, label]) => (
        <li
          key={label}
          className={`flex items-center gap-1.5 ${passed ? "text-emerald-600" : "text-slate-400"}`}
        >
          {passed ? (
            <Check className="h-3 w-3 shrink-0" />
          ) : (
            <X className="h-3 w-3 shrink-0" />
          )}
          {label}
        </li>
      ))}
    </ul>
  );
}
