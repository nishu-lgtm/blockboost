import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import type {
  AuditResult,
  CrawlabilitySection,
  SchemaSection,
  ContentSection,
  AuthoritySection,
  Recommendation,
  CheckItem,
} from "@/lib/audit-types";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const schema = z.object({
  url: z.string().url("Must be a valid URL").max(2048),
  projectId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// HTML fetch helper
// ---------------------------------------------------------------------------

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; BlockBoost-Audit/1.0; +https://blockboost.co/bot)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// robots.txt analysis
// ---------------------------------------------------------------------------

const AI_BOTS = ["GPTBot", "OAI-SearchBot", "PerplexityBot", "Googlebot"];

async function analyzeRobotsTxt(
  baseUrl: string
): Promise<{ blocking: boolean; blockedBots: string[] }> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const text = await fetchHtml(robotsUrl);
    const lines = text.split("\n").map((l) => l.trim());

    // Parse disallow rules for each agent
    const blockedBots: string[] = [];
    let currentAgents: string[] = [];

    for (const line of lines) {
      if (line.toLowerCase().startsWith("user-agent:")) {
        const agent = line.split(":")[1]?.trim() ?? "";
        currentAgents = [agent];
      } else if (line.toLowerCase().startsWith("disallow:")) {
        const path = line.split(":").slice(1).join(":").trim();
        if (path === "/" || path === "/*") {
          for (const agent of currentAgents) {
            const matched = AI_BOTS.find(
              (b) => b.toLowerCase() === agent.toLowerCase() || agent === "*"
            );
            if (matched && !blockedBots.includes(matched)) {
              blockedBots.push(matched);
            }
          }
        }
      }
    }

    return { blocking: blockedBots.length > 0, blockedBots };
  } catch {
    return { blocking: false, blockedBots: [] };
  }
}

// ---------------------------------------------------------------------------
// PageSpeed Insights
// ---------------------------------------------------------------------------

interface PSIResult {
  lcp: number;
  fcp: number;
  ttfb: number;
  performanceScore: number;
}

async function fetchPageSpeed(url: string): Promise<PSIResult | null> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile${apiKey ? `&key=${apiKey}` : ""}`;
  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number } };
        audits?: {
          "largest-contentful-paint"?: { numericValue?: number };
          "first-contentful-paint"?: { numericValue?: number };
          "server-response-time"?: { numericValue?: number };
        };
      };
    };
    const audits = data.lighthouseResult?.audits;
    return {
      lcp: Math.round((audits?.["largest-contentful-paint"]?.numericValue ?? 0) / 1000 * 10) / 10,
      fcp: Math.round((audits?.["first-contentful-paint"]?.numericValue ?? 0) / 1000 * 10) / 10,
      ttfb: Math.round(audits?.["server-response-time"]?.numericValue ?? 0),
      performanceScore: Math.round((data.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTML analysis helpers
// ---------------------------------------------------------------------------

function extractTextContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function detectSchemas(html: string): { types: string[]; rawSchemas: string[] } {
  const types: string[] = [];
  const rawSchemas: string[] = [];
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1]?.trim() ?? "";
    try {
      const parsed = JSON.parse(raw) as { "@type"?: string | string[] };
      const type = parsed["@type"];
      if (typeof type === "string" && !types.includes(type)) types.push(type);
      else if (Array.isArray(type)) {
        for (const t of type) {
          if (!types.includes(t)) types.push(t);
        }
      }
      if (raw.length < 8000) rawSchemas.push(raw); // cap raw output size
    } catch {
      // not valid JSON-LD
    }
  }
  return { types, rawSchemas };
}

function hasQuestionHeadings(html: string): boolean {
  const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = headingRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text.endsWith("?")) count++;
  }
  return count >= 2;
}

function hasFaqSection(html: string, text: string): boolean {
  const htmlLower = html.toLowerCase();
  return (
    htmlLower.includes("faq") ||
    htmlLower.includes("frequently asked") ||
    text.toLowerCase().includes("frequently asked questions")
  );
}

function checkDirectAnswer(text: string): boolean {
  // Heuristic: first 200 chars of text content answers concisely
  const first = text.slice(0, 300).toLowerCase();
  const answerIndicators = ["is ", "are ", "refers to ", "means ", "defined as ", "a ", "the ", "yes", "no"];
  return answerIndicators.some((ind) => first.includes(ind));
}

function estimateReadingLevel(wordCount: number, text: string): string {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  const avgWordsPerSentence = sentences > 0 ? wordCount / sentences : 20;
  if (avgWordsPerSentence < 12) return "Simple (8th grade)";
  if (avgWordsPerSentence < 18) return "Moderate (10th grade)";
  return "Complex (College level)";
}

function checkFactDensity(text: string): boolean {
  // Count numbers/statistics/percentages
  const statsRegex = /\b\d+(\.\d+)?%|\b\d{4}\b|\b\d+\s*(million|billion|thousand|k\b)/gi;
  const matches = text.match(statsRegex) ?? [];
  return matches.length >= 3;
}

function checkAuthorBio(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("author") ||
    lower.includes("written by") ||
    lower.includes("about the author") ||
    lower.includes("byline")
  );
}

function countExternalLinks(html: string, baseUrl: string): number {
  const domain = new URL(baseUrl).hostname;
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const linkDomain = new URL(match[1]).hostname;
      if (!linkDomain.includes(domain)) count++;
    } catch { /* skip */ }
  }
  return count;
}

function checkPublicationDate(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("published") ||
    lower.includes("updated") ||
    lower.includes("last modified") ||
    /<time[^>]+datetime/i.test(html)
  );
}

function checkSocialProof(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("review") ||
    lower.includes("testimonial") ||
    lower.includes("rating") ||
    lower.includes("stars") ||
    lower.includes("customers say")
  );
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreCrawlability(
  robots: { blocking: boolean; blockedBots: string[] },
  isHttps: boolean,
  psi: PSIResult | null,
  jsRequired: boolean
): number {
  let score = 100;
  if (robots.blocking) score -= 40;
  if (!isHttps) score -= 20;
  if (psi) {
    if (psi.lcp > 4) score -= 20;
    else if (psi.lcp > 2.5) score -= 10;
  } else {
    score -= 5; // unknown
  }
  if (jsRequired) score -= 15;
  return Math.max(0, score);
}

function scoreSchema(typesFound: string[]): number {
  const WANTED = ["FAQPage", "Article", "HowTo", "Organization", "Product", "BreadcrumbList"];
  const hits = WANTED.filter((t) => typesFound.some((f) => f.toLowerCase() === t.toLowerCase())).length;
  return Math.round((hits / WANTED.length) * 100);
}

function scoreContent(
  wordCount: number,
  directAnswer: boolean,
  questionHeadings: boolean,
  hasFaq: boolean,
  factDensity: boolean
): number {
  let score = 0;
  // word count 0-25 pts
  if (wordCount >= 800) score += 25;
  else if (wordCount >= 300) score += 15;
  else score += 5;
  if (directAnswer) score += 25;
  if (questionHeadings) score += 20;
  if (hasFaq) score += 20;
  if (factDensity) score += 10;
  return Math.min(100, score);
}

function scoreAuthority(
  authorBio: boolean,
  extLinkCount: number,
  pubDate: boolean,
  socialProof: boolean
): number {
  let score = 0;
  if (authorBio) score += 25;
  if (extLinkCount >= 3) score += 30;
  else if (extLinkCount >= 1) score += 15;
  if (pubDate) score += 25;
  if (socialProof) score += 20;
  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// OpenAI content analysis
// ---------------------------------------------------------------------------

async function analyzeContentWithAI(
  text: string,
  url: string
): Promise<{ directAnswer: boolean; summary: string }> {
  const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

  if (!openai) return { directAnswer: checkDirectAnswer(text), summary: "" };

  try {
    const excerpt = text.slice(0, 1500);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Analyze this web page content for AEO (Answer Engine Optimization). Return JSON: { "directAnswer": boolean (does the first paragraph directly answer a question?), "summary": string (1-2 sentences describing what the page is about) }',
        },
        { role: "user", content: `URL: ${url}\n\nContent:\n${excerpt}` },
      ],
      max_tokens: 150,
      temperature: 0,
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { directAnswer?: boolean; summary?: string };
    return {
      directAnswer: parsed.directAnswer ?? checkDirectAnswer(text),
      summary: parsed.summary ?? "",
    };
  } catch {
    return { directAnswer: checkDirectAnswer(text), summary: "" };
  }
}

// ---------------------------------------------------------------------------
// Recommendations builder
// ---------------------------------------------------------------------------

function buildRecommendations(
  crawl: CrawlabilitySection,
  schemaSection: SchemaSection,
  content: ContentSection,
  authority: AuthoritySection
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (crawl.robotsTxtBlocking) {
    recs.push({
      priority: "high",
      category: "crawlability",
      issue: `Your robots.txt blocks AI crawlers: ${crawl.blockedBots.join(", ")}`,
      action: "Remove or update the Disallow rules for GPTBot, OAI-SearchBot, and PerplexityBot in your robots.txt file.",
      scoreImpact: 25,
    });
  }
  if (!crawl.httpsEnabled.passed) {
    recs.push({ priority: "high", category: "crawlability", issue: "Site is not served over HTTPS", action: "Install an SSL certificate and redirect all HTTP traffic to HTTPS.", scoreImpact: 15 });
  }
  if (!crawl.pageSpeed.passed) {
    recs.push({ priority: "medium", category: "crawlability", issue: `Slow page load — LCP ${crawl.pageSpeed.lcp}s (target <2.5s)`, action: "Optimize images, enable compression, use a CDN, and defer non-critical JavaScript to improve Core Web Vitals.", scoreImpact: 10 });
  }
  if (crawl.jsRequired.passed) {
    recs.push({ priority: "medium", category: "crawlability", issue: "Content requires JavaScript to render", action: "Implement server-side rendering (SSR) or static generation so content is visible in raw HTML. AI crawlers often skip JavaScript-heavy pages.", scoreImpact: 12 });
  }

  const SCHEMA_TARGETS = ["FAQPage", "Article", "HowTo", "Organization"];
  for (const type of SCHEMA_TARGETS) {
    if (!schemaSection.typesFound.some((t) => t.toLowerCase() === type.toLowerCase())) {
      recs.push({
        priority: type === "FAQPage" ? "high" : "medium",
        category: "schema",
        issue: `Missing ${type} schema markup`,
        action: `Add a ${type} JSON-LD schema block to this page. Use the Schema Generator tab on this page to generate the markup automatically.`,
        scoreImpact: type === "FAQPage" ? 12 : 8,
      });
    }
  }

  if (!content.directAnswer.passed) {
    recs.push({ priority: "high", category: "content", issue: "First paragraph does not directly answer a question", action: "Rewrite the opening paragraph to immediately answer the core question your target audience is asking. AI models prefer pages that give concise direct answers.", scoreImpact: 15 });
  }
  if (!content.questionHeadings.passed) {
    recs.push({ priority: "medium", category: "content", issue: "Headings are not phrased as questions", action: "Rewrite at least 2-3 H2/H3 headings as questions (e.g. 'What is X?' instead of 'About X'). This directly increases the chance of AI models extracting your content as an answer.", scoreImpact: 10 });
  }
  if (!content.faqSection.passed) {
    recs.push({ priority: "medium", category: "content", issue: "No FAQ section detected", action: "Add an FAQ section with 5-10 common questions and concise answers. Pair it with FAQPage schema for maximum AI visibility.", scoreImpact: 10 });
  }
  if (content.wordCount < 300) {
    recs.push({ priority: "high", category: "content", issue: `Very short content (${content.wordCount} words)`, action: "Expand content to at least 600 words. Thin content is rarely cited by AI models.", scoreImpact: 15 });
  }

  if (!authority.authorBio.passed) {
    recs.push({ priority: "low", category: "authority", issue: "No author bio detected", action: "Add an author bio with name, title, and credentials. AI models increasingly factor authorship into content authority.", scoreImpact: 8 });
  }
  if (!authority.publicationDate.passed) {
    recs.push({ priority: "medium", category: "authority", issue: "No publication or update date visible", action: "Add a visible publication date and mark it up with <time datetime='...'> HTML. Regularly updated content is preferred by AI models.", scoreImpact: 10 });
  }

  return recs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

// ---------------------------------------------------------------------------
// Main route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const { url, projectId } = parsed.data;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // ── Fetch page ────────────────────────────────────────────────────
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      return NextResponse.json({ error: `Could not fetch URL: ${e instanceof Error ? e.message : String(e)}` }, { status: 422 });
    }

    const isHttps = url.startsWith("https://");
    const textContent = extractTextContent(html);

    // ── Parallel analysis ─────────────────────────────────────────────
    const [robots, psi, aiAnalysis] = await Promise.all([
      analyzeRobotsTxt(url),
      fetchPageSpeed(url),
      analyzeContentWithAI(textContent, url),
    ]);

    // ── Schema detection ──────────────────────────────────────────────
    const { types: schemaTypes, rawSchemas } = detectSchemas(html);

    // ── Content signals ───────────────────────────────────────────────
    const wordCount = countWords(textContent);
    const questionHeadings = hasQuestionHeadings(html);
    const faqSectionPresent = hasFaqSection(html, textContent);
    const factDensity = checkFactDensity(textContent);

    // ── Authority signals ─────────────────────────────────────────────
    const authorBioPresent = checkAuthorBio(html);
    const extLinkCount = countExternalLinks(html, url);
    const pubDatePresent = checkPublicationDate(html);
    const socialProofPresent = checkSocialProof(html);

    // ── JS rendering check ────────────────────────────────────────────
    const jsRequired = textContent.length < 200;

    // ── Build section objects ─────────────────────────────────────────
    const crawlScore = scoreCrawlability(robots, isHttps, psi, jsRequired);
    const schemaScore = scoreSchema(schemaTypes);
    const contentScore = scoreContent(wordCount, aiAnalysis.directAnswer, questionHeadings, faqSectionPresent, factDensity);
    const authorityScore = scoreAuthority(authorBioPresent, extLinkCount, pubDatePresent, socialProofPresent);
    const overallScore = Math.round((crawlScore + schemaScore + contentScore + authorityScore) / 4);

    const crawlability: CrawlabilitySection = {
      score: crawlScore,
      robotsTxtBlocking: robots.blocking,
      blockedBots: robots.blockedBots,
      aiCrawlerAccess: {
        id: "ai-crawlers",
        label: "AI crawlers allowed",
        passed: !robots.blocking,
        detail: robots.blocking
          ? `robots.txt blocks: ${robots.blockedBots.join(", ")}`
          : "GPTBot, OAI-SearchBot, and PerplexityBot are not blocked.",
      },
      httpsEnabled: {
        id: "https",
        label: "HTTPS enabled",
        passed: isHttps,
        detail: isHttps ? "Page is served over HTTPS." : "Page is served over HTTP — not secure.",
      },
      pageSpeed: {
        id: "page-speed",
        label: "Page load speed (LCP < 2.5s)",
        passed: psi ? psi.lcp <= 2.5 : true,
        detail: psi
          ? `LCP: ${psi.lcp}s · FCP: ${psi.fcp}s · TTFB: ${psi.ttfb}ms (Performance score: ${psi.performanceScore}/100)`
          : "PageSpeed data unavailable — add GOOGLE_PAGESPEED_API_KEY to enable.",
        lcp: psi?.lcp,
        fcp: psi?.fcp,
        ttfb: psi?.ttfb,
      },
      jsRequired: {
        id: "js-rendering",
        label: "Content visible without JavaScript",
        passed: !jsRequired,
        detail: jsRequired
          ? "Very little text found in raw HTML — content may require JavaScript to render."
          : "Content is accessible in raw HTML without JavaScript execution.",
      },
    };

    const SCHEMA_CHECKS = [
      { type: "FAQPage", recommendation: "Add FAQPage schema to boost your FAQ content in AI answers." },
      { type: "Article", recommendation: "Mark up your article with Article schema to improve attribution." },
      { type: "HowTo", recommendation: "Add HowTo schema if this page contains step-by-step instructions." },
      { type: "Organization", recommendation: "Add Organization schema on your homepage for entity recognition." },
      { type: "Product", recommendation: "Add Product schema if this page describes a product." },
      { type: "BreadcrumbList", recommendation: "Add BreadcrumbList schema to help AI understand your site structure." },
    ];

    const schemaSectionData: SchemaSection = {
      score: schemaScore,
      typesFound: schemaTypes,
      typesChecked: SCHEMA_CHECKS.map(({ type, recommendation }) => ({
        type,
        present: schemaTypes.some((t) => t.toLowerCase() === type.toLowerCase()),
        recommendation,
      })),
      rawSchemas,
    };

    const contentSection: ContentSection = {
      score: contentScore,
      wordCount,
      readingLevel: estimateReadingLevel(wordCount, textContent),
      directAnswer: {
        id: "direct-answer",
        label: "First paragraph answers a question directly",
        passed: aiAnalysis.directAnswer,
        detail: aiAnalysis.directAnswer
          ? "The opening content directly addresses the likely user query."
          : "The opening content does not immediately answer a clear question. AI models prefer pages with direct answers in the first paragraph.",
      },
      questionHeadings: {
        id: "question-headings",
        label: "Headings phrased as questions (≥2)",
        passed: questionHeadings,
        detail: questionHeadings
          ? "Found multiple headings phrased as questions — good for AI extraction."
          : "No question-phrased headings detected. Add H2/H3 headings ending with '?'",
      },
      faqSection: {
        id: "faq-section",
        label: "FAQ section present",
        passed: faqSectionPresent,
        detail: faqSectionPresent
          ? "FAQ section detected. Pair with FAQPage schema for full AEO benefit."
          : "No FAQ section detected. Adding one significantly increases AI citation potential.",
      },
      factDensity: {
        id: "fact-density",
        label: "Contains statistics and data (≥3 data points)",
        passed: factDensity,
        detail: factDensity
          ? "Content includes quantifiable data — AI models prefer citing factual, specific content."
          : "Content lacks statistics or data points. Adding numbers and research citations increases trustworthiness.",
      },
    };

    const authoritySection: AuthoritySection = {
      score: authorityScore,
      authorBio: {
        id: "author-bio",
        label: "Author bio present",
        passed: authorBioPresent,
        detail: authorBioPresent ? "Author information detected." : "No author bio found.",
      },
      externalLinks: {
        id: "external-links",
        label: "Links to authoritative external sources",
        passed: extLinkCount >= 2,
        detail: `${extLinkCount} external link${extLinkCount !== 1 ? "s" : ""} found. ${extLinkCount < 2 ? "Add links to authoritative sources to signal trustworthiness." : "Good — linking to authoritative sources boosts credibility."}`,
        count: extLinkCount,
      },
      publicationDate: {
        id: "pub-date",
        label: "Publication or update date visible",
        passed: pubDatePresent,
        detail: pubDatePresent ? "Date information detected." : "No publication date found. Add a visible date and <time> markup.",
      },
      socialProof: {
        id: "social-proof",
        label: "Social proof elements (reviews, testimonials)",
        passed: socialProofPresent,
        detail: socialProofPresent ? "Review or testimonial elements detected." : "No social proof found. Consider adding customer reviews or ratings.",
      },
    };

    const recommendations = buildRecommendations(crawlability, schemaSectionData, contentSection, authoritySection);

    // ── Save to database ──────────────────────────────────────────────
    const saved = await prisma.auditReport.create({
      data: {
        projectId,
        url,
        overallScore,
        crawlabilityScore: crawlScore,
        schemaScore,
        contentScore,
        authorityScore,
        robotsTxtBlocking: robots.blocking,
        schemaTypesFound: schemaTypes,
        recommendations: recommendations as unknown as object[],
        rawData: {
          crawlability,
          schema: schemaSectionData,
          content: contentSection,
          authority: authoritySection,
        } as unknown as object,
      },
    });

    const result: AuditResult = {
      id: saved.id,
      url,
      auditedAt: saved.createdAt.toISOString(),
      overallScore,
      crawlabilityScore: crawlScore,
      schemaScore,
      contentScore,
      authorityScore,
      crawlability,
      schema: schemaSectionData,
      content: contentSection,
      authority: authoritySection,
      recommendations,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Audit run error:", error);
    return NextResponse.json({ error: "Audit failed. Please try again." }, { status: 500 });
  }
}
