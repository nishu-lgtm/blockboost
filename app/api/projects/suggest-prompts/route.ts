import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import OpenAI from "openai";

const FALLBACK_PROMPTS = (brandName: string) => [
  `What is ${brandName} and what does it do?`,
  `Is ${brandName} worth it for small businesses?`,
  `${brandName} vs competitors: which is better?`,
  `What are the best alternatives to ${brandName}?`,
  `How much does ${brandName} cost?`,
  `What are the pros and cons of ${brandName}?`,
  `Who uses ${brandName}?`,
  `Does ${brandName} integrate with Salesforce and HubSpot?`,
  `What do customers say about ${brandName}?`,
  `How do I get started with ${brandName}?`,
];

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { websiteUrl, brandName } = await req.json();

    if (!websiteUrl || !brandName) {
      return NextResponse.json(
        { error: "websiteUrl and brandName are required" },
        { status: 400 }
      );
    }

    // If no OpenAI key is configured, return fallback prompts
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ prompts: FALLBACK_PROMPTS(brandName) });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert in AI search behavior and generative engine optimization (GEO). " +
            "Return only valid JSON.",
        },
        {
          role: "user",
          content:
            `Generate exactly 10 buyer-intent search prompts that someone would ask ChatGPT, Claude, ` +
            `or Perplexity when researching the brand "${brandName}" (website: ${websiteUrl}). ` +
            `Mix awareness, comparison, and purchase-intent questions. ` +
            `Return a JSON object with a single key "prompts" containing an array of 10 strings. ` +
            `Each prompt should be a complete, natural question a real buyer would type.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let prompts: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      prompts = Array.isArray(parsed.prompts) ? parsed.prompts.slice(0, 10) : [];
    } catch {
      prompts = [];
    }

    // Always return exactly 10 — fill with fallbacks if parsing went wrong
    if (prompts.length < 10) {
      const fallbacks = FALLBACK_PROMPTS(brandName);
      prompts = [
        ...prompts,
        ...fallbacks.slice(prompts.length),
      ].slice(0, 10);
    }

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("Suggest prompts error:", error);
    // Degrade gracefully — return fallbacks rather than a 500
    const { brandName } = await req.clone().json().catch(() => ({ brandName: "your brand" }));
    return NextResponse.json({ prompts: FALLBACK_PROMPTS(brandName) });
  }
}
