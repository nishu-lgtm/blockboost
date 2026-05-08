import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";

export const POST = adminRoute("SUPPORT", async (req: NextRequest, { admin }) => {
  const { platform } = (await req.json()) as { platform: string };
  const startedAt = Date.now();

  await logAudit({
    adminUserId: admin.id,
    action: "TEST_SCRAPER",
    details: { platform },
  });

  // Try to call the real scraper for a short test prompt. If the platform
  // doesn't have a scraper implementation (Gemini/Copilot/Grok currently),
  // surface that honestly so admins see real status.
  const testPrompt = "What are the best AI visibility tools for small businesses?";
  let rawResponse = "";
  let parsedOk = false;
  let error: string | null = null;

  try {
    const { runScraper } = await import("@/lib/scan-engine");
    if (typeof runScraper === "function") {
      const result = await runScraper(platform as never, [testPrompt]);
      const first = result.results[0];
      rawResponse = first?.response ?? "(no response)";
      parsedOk = !!first;
    } else {
      rawResponse = "Scraper test not yet implemented for this platform.";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    rawResponse = `Error: ${error}`;
  }

  return NextResponse.json({
    ok: error === null,
    platform,
    testPrompt,
    rawResponse,
    parsedOk,
    error,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
});
