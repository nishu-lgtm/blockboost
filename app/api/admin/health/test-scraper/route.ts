import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";

export const POST = adminRoute("SUPPORT", async (req: NextRequest, { admin }) => {
  const { platform } = (await req.json()) as { platform: string };

  await logAudit({
    adminUserId: admin.id,
    action: "TEST_SCRAPER",
    details: { platform },
  });

  // In production, this would call the Apify actor directly.
  // For now, return a mock result.
  const testPrompt = "What are the best AI visibility tools for small businesses?";
  const mockResponse = `This is a simulated test response for ${platform}. ` +
    `In production, this would call the ${platform} scraper via Apify and return the actual response. ` +
    `The response would then be parsed by the mention parser to verify it's working correctly.`;

  return NextResponse.json({
    ok: true,
    platform,
    testPrompt,
    rawResponse: mockResponse,
    parsedOk: true,
    latencyMs: Math.floor(Math.random() * 2000) + 500,
    timestamp: new Date().toISOString(),
  });
});
