"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, FlaskConical, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotTrafficActions() {
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleTest() {
    setTesting(true);
    try {
      await fetch("/api/track/test", { method: "POST" });
      setTested(true);
      router.refresh();
    } finally {
      setTesting(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    // refresh() has no awaitable signal; reset after a short visual beat
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
