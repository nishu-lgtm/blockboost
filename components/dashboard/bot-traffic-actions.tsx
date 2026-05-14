"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, FlaskConical, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// sessionStorage key — persists the verified state across router.refresh()
// (which remounts this component) but resets when the tab is closed.
const VERIFIED_KEY = "bb-snippet-tested";

function readVerified(): boolean {
  try {
    return sessionStorage.getItem(VERIFIED_KEY) === "1";
  } catch {
    return false;
  }
}

export function BotTrafficActions() {
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  // Initialise from sessionStorage so the checkmark survives router.refresh()
  const [tested, setTested] = useState(readVerified);
  const [refreshing, setRefreshing] = useState(false);

  async function handleTest() {
    setTesting(true);
    try {
      await fetch("/api/track/test", { method: "POST" });
      try { sessionStorage.setItem(VERIFIED_KEY, "1"); } catch { /* private browsing */ }
      setTested(true);
      router.refresh();
    } finally {
      setTesting(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleRefresh}
        disabled={refreshing}
        className="h-8 text-xs"
      >
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
        Refresh
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={handleTest}
        disabled={testing}
        className="h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
      >
        {tested ? (
          <>
            <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-500" />
            Snippet verified
          </>
        ) : (
          <>
            <FlaskConical className={`h-3.5 w-3.5 mr-1.5 ${testing ? "animate-pulse" : ""}`} />
            {testing ? "Testing…" : "Test snippet"}
          </>
        )}
      </Button>
    </div>
  );
}
