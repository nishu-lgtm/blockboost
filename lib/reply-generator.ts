/**
 * AI Reply Generator — creates social media replies that naturally
 * position a business as a helpful local expert.
 */

import { SocialReplyTone, SocialPlatform } from "@prisma/client";

const PLATFORM_LIMITS: Record<SocialPlatform, number> = {
  REDDIT: 150,
  QUORA: 300,
  LINKEDIN: 200,
};

const TONE_DESCRIPTORS: Record<SocialReplyTone, string> = {
  HELPFUL: "warm, conversational, and genuinely helpful — like advice from a knowledgeable friend",
  PROFESSIONAL: "authoritative and detailed — like a professional sharing their expertise",
  CASUAL: "relaxed and informal — like a peer sharing a tip they personally found useful",
};

interface GenerateReplyInput {
  opportunityId: string;
  platform: SocialPlatform;
  postTitle: string;
  postBody: string;
  subreddit?: string | null;
  brandName: string;
  city: string;
  businessCategory: string;
  keyServices?: string[];
}

export interface ReplyVariant {
  tone: SocialReplyTone;
  text: string;
  reasoning: string;
  warningFlags: string[];
  wordCount: number;
  overLimit: boolean;
}

export interface GenerateReplyResult {
  variants: ReplyVariant[];
  opportunityId: string;
}

export async function generateReplies(
  input: GenerateReplyInput
): Promise<GenerateReplyResult> {
  const { platform, postTitle, postBody, subreddit } = input;
  const limit = PLATFORM_LIMITS[platform];

  const tones: SocialReplyTone[] = ["HELPFUL", "PROFESSIONAL", "CASUAL"];
  const variants: ReplyVariant[] = [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Return placeholder variants when no API key
    for (const tone of tones) {
      variants.push(makePlaceholder(tone, input, limit));
    }
    return { variants, opportunityId: input.opportunityId };
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  for (const tone of tones) {
    const systemPrompt = buildSystemPrompt(input, tone, limit);
    const userPrompt = buildUserPrompt(postTitle, postBody, subreddit, platform);

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeParseJSON(raw);

      const text: string = typeof parsed.reply === "string" ? parsed.reply : "";
      const reasoning: string = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
      const rawFlags: string[] = Array.isArray(parsed.warningFlags)
        ? (parsed.warningFlags as string[])
        : [];

      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const overLimit = wordCount > limit;

      // Compute additional automatic warning flags
      const autoFlags = computeAutoFlags(text, input.brandName, platform, wordCount, limit);
      const warningFlags = [...new Set([...rawFlags, ...autoFlags])];

      variants.push({ tone, text, reasoning, warningFlags, wordCount, overLimit });
    } catch (err) {
      console.error(`[reply-generator] Failed to generate ${tone} variant:`, err);
      variants.push(makePlaceholder(tone, input, limit));
    }
  }

  return { variants, opportunityId: input.opportunityId };
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(
  input: GenerateReplyInput,
  tone: SocialReplyTone,
  wordLimit: number
): string {
  const { brandName, city, businessCategory, keyServices, platform } = input;
  const services = keyServices?.length ? keyServices.join(", ") : businessCategory;

  return `You are helping ${brandName}, a ${businessCategory} business in ${city}, respond to a social media post to establish their expertise and potentially get recommended.

CRITICAL RULES:
1. NEVER directly advertise or lead with the business name
2. Lead with genuinely helpful, specific information first
3. Mention the business subtly and naturally as a local recommendation — at the very end if at all
4. Match the platform tone: ${tone} — ${TONE_DESCRIPTORS[tone]}
5. Do NOT sound like marketing copy or a sponsored post
6. Maximum ${wordLimit} words — be concise
7. Include specific, useful information that demonstrates real expertise
8. For Reddit: be direct, conversational, no corporate jargon
9. For Quora: be detailed and authoritative, structured answers preferred
10. For LinkedIn: be professional, add a unique perspective

Business details:
- Name: ${brandName}
- Location: ${city}
- Category: ${businessCategory}
- Services: ${services}

Return ONLY valid JSON with exactly these fields:
{
  "reply": "the reply text here",
  "reasoning": "why this reply works for this opportunity",
  "warningFlags": ["list of any issues with this reply"]
}`;
}

function buildUserPrompt(
  title: string,
  body: string,
  subreddit: string | null | undefined,
  platform: SocialPlatform
): string {
  const platformLabel = platform === "REDDIT"
    ? `Reddit post${subreddit ? ` in r/${subreddit}` : ""}`
    : platform === "QUORA"
    ? "Quora question"
    : "LinkedIn post";

  return `Generate a reply to this ${platformLabel}:

Title: ${title}

${body ? `Body: ${body.slice(0, 800)}` : "(no additional body text)"}

Generate a helpful reply that answers the question genuinely and positions ${
    platform === "REDDIT" ? "our local business as a resource" : "our business as an expert"
  } without being promotional.`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeAutoFlags(
  text: string,
  brandName: string,
  platform: SocialPlatform,
  wordCount: number,
  limit: number
): string[] {
  const flags: string[] = [];
  const lower = text.toLowerCase();

  if (wordCount > limit) {
    flags.push(`Too long for ${platform} (${wordCount} words, max ${limit})`);
  }

  // Check if business name is mentioned too early (first 30 words)
  const firstThirtyWords = text.split(/\s+/).slice(0, 30).join(" ").toLowerCase();
  if (firstThirtyWords.includes(brandName.toLowerCase())) {
    flags.push("Business name mentioned too early — lead with helpful info first");
  }

  // Check for marketing phrases
  const marketingPhrases = [
    "best in the area", "top-rated", "award-winning", "number one",
    "industry-leading", "state-of-the-art", "cutting-edge", "we offer",
    "our services include", "contact us today", "call us",
  ];
  for (const phrase of marketingPhrases) {
    if (lower.includes(phrase)) {
      flags.push(`Sounds promotional: "${phrase}"`);
      break;
    }
  }

  // Check for unverifiable claims
  const claimPhrases = ["guaranteed", "100%", "always", "never fails", "best results"];
  for (const phrase of claimPhrases) {
    if (lower.includes(phrase)) {
      flags.push("Contains unverifiable claim — consider softening");
      break;
    }
  }

  return flags;
}

function safeParseJSON(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function makePlaceholder(
  tone: SocialReplyTone,
  input: GenerateReplyInput,
  limit: number
): ReplyVariant {
  const text = `Great question! As someone who's worked in ${input.businessCategory} in ${input.city} for a while, I'd suggest [specific advice here]. If you're in the ${input.city} area, ${input.brandName} is worth checking out — they specialise in this.`;
  const wordCount = text.split(/\s+/).length;
  return {
    tone,
    text,
    reasoning: "Placeholder reply — add your OpenAI API key for AI-generated replies",
    warningFlags: ["OpenAI API key not configured — this is a template, not an AI reply"],
    wordCount,
    overLimit: wordCount > limit,
  };
}

// ─── Quality checker (used by frontend live) ──────────────────────────────────

export interface QualityCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export function checkReplyQuality(
  text: string,
  platform: SocialPlatform,
  brandName: string,
  city: string
): QualityCheck[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  const limit = PLATFORM_LIMITS[platform];

  const checks: QualityCheck[] = [
    {
      id: "helpful",
      label: "Answers the question helpfully",
      status: words.length > 20 ? "pass" : "warn",
      message: words.length > 20 ? "Reply has enough substance" : "Reply seems too short",
    },
    {
      id: "natural_mention",
      label: "Mentions your business naturally",
      status: lower.includes(brandName.toLowerCase()) ? "pass" : "warn",
      message: lower.includes(brandName.toLowerCase())
        ? "Business name included"
        : "Consider adding a soft mention of your business",
    },
    {
      id: "city",
      label: "Location context included",
      status: lower.includes(city.toLowerCase()) ? "pass" : "warn",
      message: lower.includes(city.toLowerCase())
        ? "City name included"
        : `Consider adding "${city}" for local relevance`,
    },
    {
      id: "length",
      label: `Within ${platform} length limit`,
      status:
        words.length <= limit ? "pass" : words.length <= limit * 1.1 ? "warn" : "fail",
      message:
        words.length <= limit
          ? `${words.length}/${limit} words`
          : `${words.length} words — exceeds ${platform} limit of ${limit}`,
    },
    {
      id: "not_promotional",
      label: "Does not sound like an ad",
      status: (() => {
        const promoWords = ["contact us", "call us", "we offer", "our services", "best in"];
        return promoWords.some((p) => lower.includes(p)) ? "warn" : "pass";
      })(),
      message: (() => {
        const promoWords = ["contact us", "call us", "we offer", "our services", "best in"];
        return promoWords.some((p) => lower.includes(p))
          ? "Contains promotional language — consider rephrasing"
          : "Reads naturally, not like an ad";
      })(),
    },
  ];

  return checks;
}
