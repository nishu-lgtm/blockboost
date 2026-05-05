"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState<{ email: string; adminId: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Read impersonation info from a meta cookie exposed by the API
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith("bb_impersonate_info="))
      ?.split("=")[1];

    if (raw) {
      try {
        setImpersonating(JSON.parse(decodeURIComponent(raw)));
      } catch {
        // ignore
      }
    }
  }, []);

  if (!impersonating) return null;

  async function handleStop() {
    await fetch("/api/admin/users/impersonate/stop", { method: "POST" });
    router.push("/admin/users");
    router.refresh();
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-6 py-2.5 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="text-sm font-semibold">
          Admin mode: viewing as <span className="underline">{impersonating.email}</span>. All actions are logged.
        </span>
      </div>
      <button
        onClick={handleStop}
        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-3 py-1 rounded-lg transition-colors"
      >
        <X className="w-3.5 h-3.5" />
        Stop impersonating
      </button>
    </div>
  );
}
