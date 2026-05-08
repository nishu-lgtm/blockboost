/**
 * Public anonymous audit endpoint — no auth required.
 *
 * Runs a stripped-down "quick audit" that does HTML fetch + structural
 * checks only (no OpenAI, no PageSpeed). Returns within 2-5 seconds for
 * fast landing-page conversion. Aggressively rate-limited per IP.
 *
 * For the full audit (AI content analysis, schema generation,
 * PageSpeed metrics, persistent history) users sign up.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

interface QuickAuditResult {
  url: string;
  isHttps: boolean;
  hasFaqSection: boolean;
  hasFaqSchema: boolean;
  hasOrganizationSchema: boolean;
  hasArticleSchema: boolean;
  hasAuthorBio: boolean;
  hasPublicationDate: boolean;
  questionHeadings: number;
  wordCount: number;
  schemaTypes: string[];
  recommendations: Array<{
    priority: "high" | "medium" | "low";
    issue: string;
    action: string;
    impact: number;
  }>;
  // 0-100 quick score
  score: number;
}

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "BlockBoost-Quick-Audit/1.0 (+https://blockboost.co)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSchemas(html: string): string[] {
  const matches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];
  const types = new Set<string>();
  for (const m of matches) {
    try {
      const json = JSON.parse(m[1].trim());
      const collect = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        const obj = node as Record<string, unknown>;
        if (typeof obj["@type"] === "string") types.add(obj["@type"]);
        if (Array.isArray(obj["@type"])) {
          obj["@type"].forEach((t) => typeof t === "string" && types.add(t));
        }
        if (Array.isArray(obj["@graph"])) {
          obj["@graph"].forEach(collect);
        }
      };
      if (Array.isArray(json)) json.forEach(collect);
      else collect(json);
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return [...types];
}

function buildQuickRecommendations(
  r: Omit<QuickAuditResult, "recommendations" | "score">
): QuickAuditResult["recommendations"] {
  const recs: QuickAuditResult["recommendations"] = [];

  if (!r.isHttps) {
    recs.push({
      priority: "high",
      issue: "Site not served over HTTPS",
      action:
        "Install an SSL certificate. AI crawlers skip non-HTTPS pages by default.",
      impact: 15,
    });
  }
  if (!r.hasFaqSchema) {
    recs.push({
      priority: "high",
      issue: "Missing FAQPage schema markup",
      action:
        "Add FAQPage JSON-LD with 5-10 common questions. This is the single biggest AI visibility win.",
      impact: 12,
    });
  }
  if (!r.hasOrganizationSchema) {
    recs.push({
      priority: "medium",
      issue: "Missing Organization schema",
      action:
        "Add Organization JSON-LD with name, address, and service area so AI models recognize your brand as an entity.",
      impact: 8,
    });
  }
  if (!r.hasFaqSection) {
    recs.push({
      priority: "medium",
      issue: "No FAQ section detected on page",
      action:
        "Add an FAQ block with 5-10 customer questions. Combined with FAQPage schema this is the biggest AEO win.",
      impact: 10,
    });
  }
  if (r.questionHeadings < 2) {
    recs.push({
      priority: "medium",
      issue: "Headings aren't phrased as questions",
      action:
        "Rewrite at least 2-3 H2/H3 headings as questions. AI models use them as answer-extraction targets.",
      impact: 10,
    });
  }
  if (r.wordCount < 300) {
    recs.push({
      priority: "high",
      issue: `Very thin content (${r.wordCount} words)`,
      action:
        "Expand to at least 600 words. Thin pages are rarely cited by AI models.",
      impact: 15,
    });
  }
  if (!r.hasAuthorBio) {
    recs.push({
      priority: "low",
      issue: "No author bio detected",
      action:
        "Add an author bio with credentials. AI models increasingly factor authorship into trust.",
      impact: 8,
    });
  }
  if (!r.hasPublicationDate) {
    recs.push({
      priority: "medium",
      issue: "No visible publication date",
      action:
        "Add a publication or update date with <time datetime='...'>. Helps AI models trust freshness.",
      impact: 10,
    });
  }
  return recs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

export async function POST(req: Request) {
  // Rate limit: 3 audits per IP per day
  const ip = clientIp(req);
  const limited = rateLimit(`audit-public:${ip}`, 3, 24 * 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      {
        error:
          "You've used your free quick audits for today. Sign up free to run unlimited full audits.",
      },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid URL" },
      { status: 400 }
    );
  }

  let { url } = parsed.data;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Couldn't fetch the page (${msg}). Make sure the URL is publicly accessible.` },
      { status: 422 }
    );
  }

  const text = extractText(html);
  const schemaTypes = detectSchemas(html);
  const lowSchema = schemaTypes.map((t) => t.toLowerCase());

  const headings = [...html.matchAll(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi)].map(
    (m) => m[1].replace(/<[^>]+>/g, "").trim()
  );
  const questionHeadingCount = headings.filter((h) =>
    /^(what|why|how|when|where|who|which|can|do|does|is|are)\b/i.test(h)
  ).length;

  const result: Omit<QuickAuditResult, "score"> = {
    url,
    isHttps: url.startsWith("https://"),
    hasFaqSchema: lowSchema.includes("faqpage"),
    hasOrganizationSchema: lowSchema.includes("organization"),
    hasArticleSchema: lowSchema.includes("article") || lowSchema.includes("blogposting"),
    hasFaqSection: /faq|frequently asked/i.test(html) && /\?/.test(text),
    hasAuthorBio:
      /class=["'][^"']*(author|byline)[^"']*["']/i.test(html) ||
      /<address[^>]*>/i.test(html),
    hasPublicationDate:
      /<time[^>]+datetime=["'][^"']+["']/i.test(html) ||
      /class=["'][^"']*(date|published)[^"']*["']/i.test(html),
    questionHeadings: questionHeadingCount,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    schemaTypes,
    recommendations: [],
  };

  const recs = buildQuickRecommendations(result);

  // Quick score: start at 100, subtract impact of each issue
  const score = Math.max(0, 100 - recs.reduce((sum, r) => sum + r.impact, 0));

  return NextResponse.json({
    ...result,
    recommendations: recs,
    score,
  });
}
