import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import OpenAI from "openai";

const bodySchema = z.object({
  content: z.string().min(10, "Content must be at least 10 characters").max(8000),
  schemaType: z.enum(["FAQPage", "Article", "HowTo", "Product"]),
  brandName: z.string().optional(),
  pageUrl: z.string().url().optional(),
});

const SCHEMA_SYSTEM_PROMPTS: Record<string, string> = {
  FAQPage: `You are a structured data expert. Given a list of questions and answers (or raw FAQ content), generate a valid JSON-LD FAQPage schema. Follow Google's guidelines exactly. Output ONLY the JSON-LD object — no markdown fences, no explanation. The schema must include @context, @type, and a mainEntity array of Question objects each with acceptedAnswer.`,

  Article: `You are a structured data expert. Given article content, generate a valid JSON-LD Article schema. Follow Google's guidelines. Output ONLY the JSON-LD object — no markdown fences. Include @context, @type (Article or BlogPosting), headline, description, author (Person), publisher (Organization with logo), datePublished, dateModified, and mainEntityOfPage. Use reasonable placeholders where data is missing.`,

  HowTo: `You are a structured data expert. Given how-to content or a step list, generate a valid JSON-LD HowTo schema. Follow Google's guidelines exactly. Output ONLY the JSON-LD object — no markdown fences. Include @context, @type (HowTo), name, description, step array (each with @type HowToStep, name, text), and optionally totalTime in ISO 8601 duration format.`,

  Product: `You are a structured data expert. Given product information, generate a valid JSON-LD Product schema. Follow Google's guidelines. Output ONLY the JSON-LD object — no markdown fences. Include @context, @type (Product), name, description, brand (Brand with name), offers (Offer with price, priceCurrency, availability). Use realistic placeholders for missing data.`,
};

// Static fallback generators for when OpenAI is unavailable
function fallbackFAQ(content: string): string {
  const lines = content.split("\n").filter((l) => l.trim());
  const pairs: Array<{ q: string; a: string }> = [];
  let currentQ = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.endsWith("?") || trimmed.startsWith("Q:") || trimmed.startsWith("Question:")) {
      currentQ = trimmed.replace(/^(Q:|Question:)\s*/i, "");
    } else if (currentQ && trimmed) {
      pairs.push({ q: currentQ, a: trimmed.replace(/^(A:|Answer:)\s*/i, "") });
      currentQ = "";
    }
  }
  if (pairs.length === 0 && lines.length >= 2) {
    // Treat alternating lines as Q/A
    for (let i = 0; i < lines.length - 1; i += 2) {
      pairs.push({ q: lines[i].trim(), a: lines[i + 1].trim() });
    }
  }

  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: pairs.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
    null,
    2
  );
}

function fallbackArticle(brandName = "Your Brand", pageUrl = "https://example.com"): string {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Article Title",
      description: "Article description goes here.",
      author: { "@type": "Person", name: "Author Name" },
      publisher: {
        "@type": "Organization",
        name: brandName,
        logo: { "@type": "ImageObject", url: `${pageUrl}/logo.png` },
      },
      datePublished: new Date().toISOString().slice(0, 10),
      dateModified: new Date().toISOString().slice(0, 10),
      mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    },
    null,
    2
  );
}

function fallbackHowTo(content: string): string {
  const lines = content.split("\n").filter((l) => l.trim());
  const steps = lines
    .filter((l) => /^\d+[\.\)]\s/.test(l) || l.trim().startsWith("-") || l.trim().startsWith("•"))
    .slice(0, 10)
    .map((l, i) => ({
      "@type": "HowToStep",
      name: `Step ${i + 1}`,
      text: l.replace(/^(\d+[\.\)]|-|•)\s*/, "").trim(),
    }));

  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How To Guide",
      description: lines[0] ?? "Step-by-step guide.",
      step: steps.length > 0 ? steps : [{ "@type": "HowToStep", name: "Step 1", text: lines[0] ?? "" }],
    },
    null,
    2
  );
}

function fallbackProduct(brandName = "Your Brand"): string {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Product Name",
      description: "Product description.",
      brand: { "@type": "Brand", name: brandName },
      offers: {
        "@type": "Offer",
        price: "0.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    },
    null,
    2
  );
}

function generateFallback(
  type: string,
  content: string,
  brandName?: string,
  pageUrl?: string
): string {
  switch (type) {
    case "FAQPage":   return fallbackFAQ(content);
    case "Article":   return fallbackArticle(brandName, pageUrl);
    case "HowTo":     return fallbackHowTo(content);
    case "Product":   return fallbackProduct(brandName);
    default:          return fallbackFAQ(content);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { content, schemaType, brandName, pageUrl } = parsed.data;

    const openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;

    if (!openai) {
      const schema = generateFallback(schemaType, content, brandName, pageUrl);
      return NextResponse.json({ schema, generated: false });
    }

    try {
      const systemPrompt = SCHEMA_SYSTEM_PROMPTS[schemaType];
      const userContent = [
        brandName ? `Brand: ${brandName}` : null,
        pageUrl ? `Page URL: ${pageUrl}` : null,
        `Content:\n${content}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 1500,
        temperature: 0.2,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";

      // Strip any accidental markdown fences
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      // Validate it's parseable JSON
      JSON.parse(cleaned);

      return NextResponse.json({ schema: cleaned, generated: true });
    } catch {
      // OpenAI failed or returned bad JSON — use fallback
      const schema = generateFallback(schemaType, content, brandName, pageUrl);
      return NextResponse.json({ schema, generated: false });
    }
  } catch (error) {
    console.error("Generate schema error:", error);
    return NextResponse.json({ error: "Schema generation failed." }, { status: 500 });
  }
}
