/**
 * POST /api/projects/suggest-prompts
 *
 * Body:  { websiteUrl: string, brandName: string }
 * Reply: { prompts: string[] }   ← stable shape, NOT changing this signature
 *
 * What changed in Sprint 1 step 4: the system prompt now requires a balanced
 * mix across the 5 QueryIntent buckets (Discovery / Comparison / Commercial /
 * Problem / Recommendation). Server-side we verify the returned prompts span
 * at least 4 of the 5 intent buckets; if not, we fall back to a curated
 * 10-prompt list that's balanced by construction.
 *
 * The intent is NOT returned to the caller (avoids breaking
 * components/onboarding/step-prompts.tsx); intents get re-classified at
 * insert time by classifyIntent() in /api/projects/create.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { llmCall } from "@/lib/llm-call";
import { classifyIntent } from "@/lib/query-intent";
import { logSafeError } from "@/lib/safe-error";

// Curated 10-prompt fallback — 2 per intent bucket. Used when:
//   - OpenAI is unavailable
//   - The model returns an unbalanced mix (< 4 of 5 buckets covered)
//   - Body validation fails
function balancedFallback(brandName: string): string[] {
  return [
    // DISCOVERY (2)
    `best alternatives to ${brandName}`,
    `top tools like ${brandName} in 2026`,
    // COMPARISON (2)
    `${brandName} vs competitors: which is better`,
    `${brandName} compared to its main alternatives`,
    // COMMERCIAL (2)
    `${brandName} pricing and plans`,
    `${brandName} free tier — is it worth it`,
    // PROBLEM (2)
    `how to get started with ${brandName}`,
    `why use ${brandName} over the alternatives`,
    // RECOMMENDATION (2)
    `what do people recommend instead of ${brandName}`,
    `is ${brandName} a good fit for small businesses`,
  ];
}

const llmOutputSchema = z.object({
  prompts: z.array(z.string().min(3).max(300)).min(1).max(15),
});

const bodySchema = z.object({
  websiteUrl: z.string().min(1).max(2048),
  brandName: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "websiteUrl and brandName are required" },
        { status: 400 }
      );
    }
    const { websiteUrl, brandName } = parsed.data;

    const systemPrompt =
      "You generate buyer-intent search prompts that someone might type into " +
      "ChatGPT / Claude / Perplexity when researching a brand. " +
      "Return EXACTLY 10 prompts. Include AT LEAST TWO of each: " +
      "(1) DISCOVERY — \"best X\", \"top X 2026\". " +
      "(2) COMPARISON — \"X vs Y\", \"X compared to Y\". " +
      "(3) COMMERCIAL — pricing/cost/cheapest. " +
      "(4) PROBLEM — \"how to X\", \"why X\". " +
      "(5) RECOMMENDATION — \"what do people recommend for X\". " +
      "Each prompt must be a natural question a real user would type. " +
      'Reply ONLY with JSON: {"prompts": ["...", ...]}.';

    const userPrompt = `Brand: ${brandName}\nWebsite: ${websiteUrl}`;

    const fallback = { prompts: balancedFallback(brandName) };
    const result = await llmCall({
      feature: "suggest-prompts:v2",
      model: "fast",
      schema: llmOutputSchema,
      fallback,
      temperature: 0.6,
      maxTokens: 800,
      cacheTtlSec: 24 * 60 * 60, // same brand/site → same 10 prompts for 24h
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    let prompts = result.data.prompts.slice(0, 10);

    // Server-side balance check — if the model returned <4 of 5 buckets,
    // use the curated fallback. This is the "ground truth" Rule 5 demands:
    // the rules know the intent, not the model.
    if (result.isFresh) {
      const buckets = new Set(prompts.map((p) => classifyIntent(p)));
      if (buckets.size < 4) {
        prompts = balancedFallback(brandName);
      }
    }

    // Always return exactly 10 — pad with curated fallback if short.
    if (prompts.length < 10) {
      const padding = balancedFallback(brandName).filter((p) => !prompts.includes(p));
      prompts = [...prompts, ...padding].slice(0, 10);
    }

    return NextResponse.json({ prompts });
  } catch (err) {
    logSafeError("[suggest-prompts] error:", err);
    // Degrade gracefully — never 500 on this endpoint, the user needs SOMETHING.
    let brandName = "your brand";
    try {
      const b = (await req.clone().json()) as { brandName?: string };
      if (typeof b.brandName === "string" && b.brandName.length > 0) brandName = b.brandName;
    } catch {
      // ignore — fallback already handles the unknown-brand case
    }
    return NextResponse.json({ prompts: balancedFallback(brandName) });
  }
}
