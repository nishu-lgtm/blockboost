import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getTopQueries,
  refreshAccessToken,
  isTokenExpired,
} from "@/lib/google-search-console";
import OpenAI from "openai";

const bodySchema = z.object({
  siteUrl: z.string().min(1),
  projectId: z.string().optional(), // if provided → saves to DB
  limit: z.number().int().min(1).max(200).default(50),
});

// ---------------------------------------------------------------------------
// Category heuristic (fallback when OpenAI unavailable)
// ---------------------------------------------------------------------------

function guessCategory(text: string): string {
  const lc = text.toLowerCase();
  if (lc.includes("near me") || lc.includes("in ")) return "local";
  if (lc.includes("how to") || lc.includes("what is") || lc.includes("why")) return "informational";
  if (lc.includes("vs") || lc.includes("compare") || lc.includes("alternative") || lc.includes("difference")) return "comparison";
  if (lc.includes("buy") || lc.includes("price") || lc.includes("cost") || lc.includes("plan")) return "purchase";
  return "awareness";
}

// ---------------------------------------------------------------------------
// Bulk categorization via OpenAI
// ---------------------------------------------------------------------------

async function categorizeQueries(
  queries: string[]
): Promise<Record<string, string>> {
  if (!process.env.OPENAI_API_KEY || queries.length === 0) {
    return Object.fromEntries(queries.map((q) => [q, guessCategory(q)]));
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const prompt = `Categorize each search query into exactly one of: awareness, comparison, purchase, local, informational.

Definitions:
- awareness: general questions about a topic or product type
- comparison: comparing products, brands, or options
- purchase: ready-to-buy queries with pricing/plan intent
- local: location-based queries
- informational: how-to, educational, or factual queries

Return ONLY a JSON array: [{"query": "...", "category": "..."}]

Queries: ${JSON.stringify(queries)}`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const arr: { query: string; category: string }[] = parsed.categories ?? parsed.queries ?? parsed.result ?? [];

    const map: Record<string, string> = {};
    for (const item of arr) {
      if (item.query && item.category) map[item.query] = item.category;
    }
    return map;
  } catch {
    // Fallback to heuristic
    return Object.fromEntries(queries.map((q) => [q, guessCategory(q)]));
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { siteUrl, projectId, limit } = parsed.data;

    // Get user GSC tokens
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        gscConnected: true,
        gscAccessToken: true,
        gscRefreshToken: true,
        gscTokenExpiry: true,
        projects: projectId
          ? { where: { id: projectId }, select: { id: true, brandName: true } }
          : { select: { id: true, brandName: true }, take: 1 },
      },
    });

    if (!user?.gscConnected || !user.gscAccessToken) {
      return NextResponse.json({ error: "GSC not connected" }, { status: 400 });
    }

    let accessToken = user.gscAccessToken;

    // Auto-refresh token if expired
    if (isTokenExpired(user.gscTokenExpiry) && user.gscRefreshToken) {
      const refreshed = await refreshAccessToken(user.gscRefreshToken);
      accessToken = refreshed.accessToken;
      await prisma.user.update({
        where: { id: session.user.id },
        data: { gscAccessToken: accessToken, gscTokenExpiry: refreshed.expiresAt },
      });
    }

    const brandName = user.projects[0]?.brandName ?? "";

    // Fetch queries from GSC
    const rawQueries = await getTopQueries(accessToken, siteUrl, 90, 200);

    // Filter
    const filtered = rawQueries
      .filter((q) => q.impressions >= 10) // remove low-volume
      .filter((q) => brandName
        ? !q.query.toLowerCase().includes(brandName.toLowerCase())
        : true) // remove branded
      .slice(0, limit);

    if (filtered.length === 0) {
      return NextResponse.json({ imported: 0, queries: [] });
    }

    // Categorize
    const queryTexts = filtered.map((q) => q.query);
    const categoryMap = await categorizeQueries(queryTexts);

    const enriched = filtered.map((q) => ({
      text: q.query,
      category: categoryMap[q.query] ?? guessCategory(q.query),
      impressions: q.impressions,
      clicks: q.clicks,
      position: Math.round(q.position * 10) / 10,
    }));

    // If projectId provided → save to DB (upsert by text+projectId)
    if (projectId) {
      // Verify project ownership
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: session.user.id },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const now = new Date();
      let importedCount = 0;

      for (const q of enriched) {
        const existing = await prisma.prompt.findFirst({
          where: { projectId, text: q.text },
        });

        if (existing) {
          // Update GSC metadata
          await prisma.prompt.update({
            where: { id: existing.id },
            data: {
              gscImpressions: q.impressions,
              gscClicks: q.clicks,
              gscPosition: q.position,
              gscLastSync: now,
            },
          });
        } else {
          // Create new prompt
          await prisma.prompt.create({
            data: {
              projectId,
              text: q.text,
              category: q.category,
              gscImpressions: q.impressions,
              gscClicks: q.clicks,
              gscPosition: q.position,
              gscLastSync: now,
            },
          });
          importedCount++;
        }
      }

      return NextResponse.json({
        imported: importedCount,
        updated: enriched.length - importedCount,
        queries: enriched,
      });
    }

    // No projectId → just return without saving (used during onboarding)
    return NextResponse.json({ imported: enriched.length, queries: enriched });
  } catch (error) {
    console.error("[gsc/import-queries] error:", error);
    return NextResponse.json({ error: "Failed to import queries" }, { status: 500 });
  }
}
