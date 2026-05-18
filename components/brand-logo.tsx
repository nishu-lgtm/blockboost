/**
 * Shared brand wordmark used across landing, auth, onboarding, dashboard,
 * legal, and shared-report pages. Single source of truth for the visual
 * identity (amber Zap icon + two-tone wordmark).
 *
 * Variants:
 *  - "default" — black/amber wordmark on light background (auth, dashboard)
 *  - "dark"    — white/amber wordmark on dark background (footer)
 *  - "icon-only" — just the Zap icon (compact areas)
 */
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "default" | "dark" | "icon-only";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { icon: "w-4 h-4", text: "text-base" },
  md: { icon: "w-5 h-5", text: "text-lg" },
  lg: { icon: "w-6 h-6", text: "text-xl" },
};

export function BrandLogo({
  variant = "default",
  size = "md",
  className,
}: Props) {
  const s = sizeMap[size];

  if (variant === "icon-only") {
    return <Zap className={cn(s.icon, "text-amber-500", className)} />;
  }

  const blockColor = variant === "dark" ? "text-white" : "text-slate-900";
  const accent = variant === "dark" ? "text-amber-400" : "text-amber-500";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Zap className={cn(s.icon, accent)} />
      <span className={cn(s.text, "font-bold")}>
        <span className={blockColor}>Block</span>
        <span className={accent}>Boost</span>
      </span>
    </div>
  );
}
