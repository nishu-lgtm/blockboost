import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import type { BriefContent, BriefQualityScore } from "@/lib/brief-types";

const bodySchema = z.object({
  projectId: z.string().min(1),
  promptText: z.string().min(3, "Prompt must be at least 3 characters").max(500),
  promptId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Quality scoring
// ---------------------------------------------------------------------------

function scoreDirectAnswer(da: string): number {
  if (!da) return 0;
  const words = da.trim().split(/\s+/).length;
  if (words > 55) return 40;
  const startsDirectly = /^(yes|no|a |an |the |it |this |[a-z]{3,} is |[a-z]{3,} are )/i.test(da);
  return startsDirectly ? 100 : 70;
}

function scoreHeadings(headings: string[]): number {
  if (!headings.length) return 0;
  const questionRatio = headings.filter((h) => h.trim().endsWith("?")).length / headings.length;
  return Math.round(questionRatio * 100);
}

function computeQualityScore(content: BriefContent): BriefQualityScore {
  const breakdown = {
    directAnswer: scoreDirectAnswer(content.directAnswer),
    headings: scoreHeadings(content.headings),
    faqCoverage: Math.min(100, Math.round((content.faqs.length / 10) * 100)),
    keywords: content.keywords.length >= 5 ? 100 : Math.round((content.keywords.length / 5) * 100),
    eeat: content.eeatRecommendations.length >= 3 ? 100 : Math.round((content.eeatRecommendations.length / 3) * 100),
  };
  const total = Math.round(
    breakdown.directAnswer * 0.3 +
    breakdown.headings * 0.2 +
    breakdown.faqCoverage * 0.2 +
    breakdown.keywords * 0.15 +
    breakdown.eeat * 0.15
  );
  return { total, breakdown };
}

// ---------------------------------------------------------------------------
// FAQPage schema generator
// ---------------------------------------------------------------------------

function generateFaqSchema(faqs: BriefContent["faqs"]): string {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
    null,
    2
  );
}

// ---------------------------------------------------------------------------
// Fallback brief (used when OpenAI is unavailable)
// ---------------------------------------------------------------------------

function buildFallbackBrief(
  promptText: string,
  brandName: string,
  competitorNames: string[]
): BriefContent {
  const q = promptText.trim().replace(/\?$/, "");
  return {
    contentType: "FAQ page",
    directAnswer: `${brandName} helps you ${q.toLowerCase()}. We provide comprehensive solutions designed for your specific needs — get started in minutes.`,
    headings: [
      `What is the best way to ${q.toLowerCase()}?`,
      `How does ${brandName} help with ${q.toLowerCase()}?`,
      `What should you look for when evaluating options?`,
      `How does ${brandName} compare to alternatives?`,
      `What are common mistakes to avoid?`,
      `How quickly can you see results?`,
      `Is ${brandName} right for your use case?`,
    ],
    faqs: [
      { question: `What is ${q}?`, answer: `${q} refers to the process of achieving a specific outcome. ${brandName} provides tools and support to make this accessible for teams of all sizes.` },
      { question: `How does ${brandName} approach ${q.toLowerCase()}?`, answer: `${brandName} uses a data-driven methodology combined with AI-powered insights to deliver measurable results.` },
      { question: `How long does it take to get started?`, answer: "Most customers are fully onboarded within 24 hours. Our step-by-step setup wizard guides you through the process." },
      { question: `What makes ${brandName} different from competitors?`, answer: `Unlike ${competitorNames.slice(0, 2).join(" and ")}, ${brandName} focuses exclusively on delivering actionable insights with zero setup friction.` },
      { question: "Is there a free trial available?", answer: `Yes, ${brandName} offers a 14-day free trial with no credit card required.` },
      { question: "What integrations are supported?", answer: `${brandName} integrates with all major platforms. Check our integrations page for the full list.` },
      { question: "Do you offer customer support?", answer: `${brandName} provides email and live chat support on all plans, plus dedicated account management for Enterprise customers.` },
      { question: "What reporting and analytics are available?", answer: `${brandName} provides real-time dashboards, weekly email digests, and custom report exports in CSV and PDF formats.` },
    ],
    schemaType: "FAQPage",
    targetWordCount: 1200,
    keywords: [brandName, q, `${brandName} review`, `best ${q.toLowerCase()}`, `${q.toLowerCase()} tool`],
    eeatRecommendations: [
      "Include author bio with relevant credentials and years of experience",
      "Cite at least 3 third-party studies or industry reports with links",
      "Add customer case studies with specific quantified outcomes",
    ],
    internalLinkingSuggestions: [
      "Link to your pricing page from the comparison section",
      "Link to your getting started guide from the onboarding FAQ",
      "Link to customer testimonials page from the social proof section",
    ],
    competitorGaps: competitorNames.length > 0
      ? [`${competitorNames[0]} covers pricing transparency — add a clear pricing comparison`]
      : ["Cover implementation time and ROI metrics explicitly"],
  };
}

// ---------------------------------------------------------------------------
// OpenAI brief generation
// ---------------------------------------------------------------------------

async function generateWithOpenAI(
  promptText: string,
  brandName: string,
  websiteUrl: string,
  competitorNames: string[]
): Promise<BriefContent> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const systemPrompt = `You are an AEO/GEO content strategist specialising in making brands appear in AI-generated search results (ChatGPT, Perplexity, Google AI Overviews). Your briefs are precise, actionable, and optimised for AI citation.

Return a JSON object with EXACTLY these keys:
- contentType: string (e.g. "FAQ page", "Blog post", "Landing page", "Comparison page")
- directAnswer: string (≤50 words, starts with a direct factual answer — NOT with the brand name)
- headings: string[] (exactly 7 H2s, ALL phrased as questions ending with "?")
- faqs: array of {question: string, answer: string} (exactly 10 pairs; answers 40-80 words each)
- schemaType: string (the single best schema type: "FAQPage", "Article", "HowTo", or "Product")
- targetWordCount: number (600-2000, appropriate for the content type)
- keywords: string[] (8-12 specific long-tail keywords/phrases to include naturally)
- eeatRecommendations: string[] (5 specific E-E-A-T signals to add: credentials, data sources, case studies, etc.)
- internalLinkingSuggestions: string[] (4-5 specific internal pages to link to and from where)
- competitorGaps: string[] (3-5 specific topics/angles competitors cover that this page should also address)

Be specific. Avoid generic advice. Include the brand name and competitors naturally.`;

  const userPrompt = `Brand: ${brandName}
Website: ${websiteUrl}
Competitors: ${competitorNames.length > 0 ? competitorNames.join(", ") : "none specified"}
Target prompt/question: "${promptText}"

Generate a comprehensive AEO content brief so ${brandName} appears when someone asks: "${promptText}"${
    competitorNames.length > 0
      ? ` Currently, ${competitorNames.slice(0, 3).join(", ")} appear for this prompt but ${brandName} does not.`
      : "."
  }`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 2500,
    temperature: 0.4,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<BriefContent>;

  // Normalise and fill any missing fields
  return {
    contentType: parsed.contentType ?? "FAQ page",
    directAnswer: parsed.directAnswer ?? `${brandName} provides a comprehensive solution for ${promptText}.`,
    headings: Array.isArray(parsed.headings) ? parsed.headings.slice(0, 7) : [],
    faqs: Array.isArray(parsed.faqs) ? parsed.faqs.slice(0, 10) : [],
    schemaType: parsed.schemaType ?? "FAQPage",
    targetWordCount: parsed.targetWordCount ?? 1200,
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    eeatRecommendations: Array.isArray(parsed.eeatRecommendations) ? parsed.eeatRecommendations : [],
    internalLinkingSuggestions: Array.isArray(parsed.internalLinkingSuggestions) ? parsed.internalLinkingSuggestions : [],
    competitorGaps: Array.isArray(parsed.competitorGaps) ? parsed.competitorGaps : [],
  };
}

// ---------------------------------------------------------------------------
// Derive a brief topic from the prompt
// ---------------------------------------------------------------------------

function deriveTopic(promptText: string, brandName: string): string {
  const cleaned = promptText
    .replace(/\?$/, "")
    .replace(/^(what is|what are|how do|how to|best|top)\s+/i, "")
    .trim();
  return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned;
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
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const { projectId, promptText } = parsed.data;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: { competitors: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const competitorNames = project.competitors.map((c) => c.brandName);

    // Check for existing brief for this exact prompt
    const existing = await prisma.contentBrief.findFirst({
      where: { projectId, promptText: { equals: promptText } },
      orderBy: { createdAt: "desc" },
    });
    if (existing && existing.status !== "PENDING" && existing.briefContent) {
      // Return cached brief
      const content = existing.briefContent as unknown as BriefContent;
      return NextResponse.json({
        id: existing.id,
        projectId,
        promptText,
        topic: existing.topic,
        status: existing.status,
        briefContent: content,
        schemaMarkup: existing.schemaMarkup,
        qualityScore: computeQualityScore(content),
        createdAt: existing.createdAt.toISOString(),
        wordCountEstimate: content.targetWordCount,
        cached: true,
      });
    }

    // Generate brief
    let briefContent: BriefContent;
    if (process.env.OPENAI_API_KEY) {
      try {
        briefContent = await generateWithOpenAI(promptText, project.brandName, project.websiteUrl, competitorNames);
      } catch (err) {
        console.warn("[briefs/generate] OpenAI failed, using fallback:", err);
        briefContent = buildFallbackBrief(promptText, project.brandName, competitorNames);
      }
    } else {
      briefContent = buildFallbackBrief(promptText, project.brandName, competitorNames);
    }

    const schemaMarkup = briefContent.faqs.length > 0
      ? generateFaqSchema(briefContent.faqs)
      : null;

    const qualityScore = computeQualityScore(briefContent);
    const topic = deriveTopic(promptText, project.brandName);

    // Upsert: update if PENDING exists, else create new
    let savedBrief;
    if (existing) {
      savedBrief = await prisma.contentBrief.update({
        where: { id: existing.id },
        data: {
          topic,
          status: "GENERATED",
          briefContent: briefContent as unknown as object,
          schemaMarkup,
        },
      });
    } else {
      savedBrief = await prisma.contentBrief.create({
        data: {
          projectId,
          promptText,
          topic,
          status: "GENERATED",
          briefContent: briefContent as unknown as object,
          schemaMarkup,
        },
      });
    }

    // Fire brief-generated trigger (fire-and-forget)
    const briefUserId = session.user?.id;
    if (briefUserId) {
      import("@/lib/email-triggers").then(({ onBriefGenerated }) =>
        onBriefGenerated(briefUserId).catch((e) =>
          console.error("[briefs/generate] onBriefGenerated failed:", e)
        )
      );
    }

    return NextResponse.json({
      id: savedBrief.id,
      projectId,
      promptText,
      topic,
      status: savedBrief.status,
      briefContent,
      schemaMarkup,
      qualityScore,
      createdAt: savedBrief.createdAt.toISOString(),
      wordCountEstimate: briefContent.targetWordCount,
      cached: false,
    });
  } catch (error) {
    console.error("Brief generation error:", error);
    return NextResponse.json({ error: "Failed to generate brief." }, { status: 500 });
  }
}
