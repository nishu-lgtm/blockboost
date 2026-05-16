"use client";

import { Check, X } from "lucide-react";
import { getPasswordChecks } from "@/lib/password-policy";

/**
 * Live password policy checklist. Each rule shows a green check (passed) or
 * a slate-grey marker (not yet passed) so the user knows the rules BEFORE
 * they start typing — previously the list was hidden when the input was
 * empty, which left users with no preview of what was required and they'd
 * find out only after submitting. (User feedback 2026-05-16.)
 *
 * Use on /auth/signup and /auth/reset-password — not on /auth/login since
 * the user is entering an existing password we don't validate against policy.
 */
export function PasswordPolicyHints({ password }: { password: string }) {
  const checks = getPasswordChecks(password);
  const rules: Array<[boolean, string]> = [
    [checks.minLength, "At least 10 characters"],
    [checks.hasLetter, "Contains a letter"],
    [checks.hasNumber, "Contains a number"],
    [checks.notCommon, "Not a common / leaked password"],
  ];

  return (
    <div className="mt-2">
      <p className="text-[11px] text-slate-500 mb-1.5">
        Your password must meet all of the following:
      </p>
      <ul className="space-y-1 text-xs">
        {rules.map(([passed, label]) => (
          <li
            key={label}
            className={`flex items-center gap-1.5 transition-colors ${
              passed ? "text-emerald-600" : "text-slate-400"
            }`}
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
    </div>
  );
}
