"use client";

import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Password input with show/hide eye toggle. Drop-in replacement for the
 * <Input type="password"> pattern. Same controlled-input contract (value,
 * onChange) so existing form code doesn't need restructuring.
 *
 * Used on /auth/login, /auth/signup, /auth/reset-password, and
 * /dashboard/settings change-password form.
 */
interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  className?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          id={props.id}
          type={show ? "text" : "password"}
          value={props.value}
          onChange={props.onChange}
          placeholder={props.placeholder}
          required={props.required}
          minLength={props.minLength}
          autoComplete={props.autoComplete}
          className={`pr-10 ${props.className ?? ""}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:text-slate-700"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
