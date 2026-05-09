/**
 * OpenAI Moderation pre-check. Calls /v1/moderations (free, ~50ms) before
 * spending money on chat completion. Blocks requests flagged for hate,
 * harassment, self-harm, sexual content involving minors, or violence.
 *
 * Set `OPENAI_MODERATION_DISABLED=true` to skip (e.g. during local dev to
 * save round-trips). Production should ALWAYS run this before AI calls
 * that accept user-controlled or web-scraped content.
 */

import OpenAI from "openai";

const DISABLED = process.env.OPENAI_MODERATION_DISABLED === "true";

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
  categories?: string[];
}

/**
 * Returns `{ allowed: true }` if the content is safe to send to GPT, or
 * `{ allowed: false, reason }` if flagged. On any error (including no API
 * key configured) returns allowed: true and logs — we don't want moderation
 * outage to break the product.
 */
export async function moderateContent(
  content: string
): Promise<ModerationResult> {
  if (DISABLED) return { allowed: true };
  const c = getClient();
  if (!c) return { allowed: true };

  try {
    const res = await c.moderations.create({
      model: "omni-moderation-latest",
      input: content.slice(0, 32_000), // moderation API limit
    });
    const result = res.results?.[0];
    if (!result) return { allowed: true };
    if (!result.flagged) return { allowed: true };

    const cats = Object.entries(result.categories ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k);

    return {
      allowed: false,
      reason: "Content was flagged as unsafe by content moderation.",
      categories: cats,
    };
  } catch (err) {
    console.warn(
      "[moderation] check failed — defaulting to allowed:",
      err instanceof Error ? err.message : err
    );
    return { allowed: true };
  }
}
