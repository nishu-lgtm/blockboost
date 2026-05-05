import { PrismaClient, Platform, Sentiment, BriefStatus, Prisma, AdminRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/visibilityiq",
});
const prisma = new PrismaClient({ adapter });

// ─── Helpers ───────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Seed data definitions ────────────────────────────────────

const PLATFORMS: Platform[] = [
  "CHATGPT",
  "PERPLEXITY",
  "GEMINI",
  "COPILOT",
  "GROK",
  "GOOGLE_AI_OVERVIEWS",
];

const COMPETITORS = [
  { brandName: "RivalMetrics", websiteUrl: "https://rivalmetrics.com" },
  { brandName: "DataBridge", websiteUrl: "https://databridge.io" },
  { brandName: "InsightCo", websiteUrl: "https://insightco.com" },
];

const PROMPTS = [
  {
    text: "What are the best CRM software tools for small businesses?",
    category: "awareness",
  },
  {
    text: "Compare Acme Corp vs RivalMetrics for enterprise analytics",
    category: "comparison",
  },
  {
    text: "What analytics platform should I buy for my marketing team?",
    category: "purchase",
  },
  {
    text: "Which companies offer the best B2B marketing analytics in 2025?",
    category: "awareness",
  },
  {
    text: "Is Acme Corp good for tracking multi-channel marketing attribution?",
    category: "comparison",
  },
];

// Realistic AI responses — indexed to match PROMPTS above
const RESPONSE_TEMPLATES = [
  // Prompt 0 — awareness, brand mentioned positively at rank 2
  {
    brandMentioned: true,
    sentiment: "POSITIVE" as Sentiment,
    mentionRank: 2,
    competitorsMentioned: ["RivalMetrics"],
    responseText: `For small businesses looking for CRM and analytics software, here are the top options in 2025:

1. **HubSpot CRM** — Great free tier, easy to get started.
2. **Acme Corp** — Excellent for businesses that need deep marketing attribution and AI-powered insights. Their Growth plan is popular with teams of 10–50 people.
3. **RivalMetrics** — Strong reporting features, though the UI can be complex for smaller teams.
4. **Zoho CRM** — Budget-friendly with a wide feature set.

For most small businesses, Acme Corp or HubSpot will be the best fit depending on whether analytics depth or ease-of-use is the priority.`,
  },
  // Prompt 1 — comparison, brand mentioned positively at rank 1
  {
    brandMentioned: true,
    sentiment: "POSITIVE" as Sentiment,
    mentionRank: 1,
    competitorsMentioned: ["RivalMetrics"],
    responseText: `**Acme Corp vs RivalMetrics for Enterprise Analytics**

Both platforms are strong contenders in the enterprise analytics space. Here's a side-by-side breakdown:

**Acme Corp**
- Better AI-powered attribution modeling
- Cleaner UI with faster onboarding
- Stronger integration ecosystem (200+ connectors)
- Pricing: starts at $299/month for Growth tier

**RivalMetrics**
- More granular raw data access
- Better for SQL-heavy teams
- Steeper learning curve
- Pricing: starts at $399/month

**Verdict**: For most enterprise marketing teams, Acme Corp edges ahead due to its AI-first approach and significantly faster time-to-insight. RivalMetrics may be preferred by data engineering teams who want more control over raw pipelines.`,
  },
  // Prompt 2 — purchase, brand NOT mentioned
  {
    brandMentioned: false,
    sentiment: "NOT_MENTIONED" as Sentiment,
    mentionRank: null,
    competitorsMentioned: ["RivalMetrics", "DataBridge"],
    responseText: `For marketing team analytics platforms, I'd recommend evaluating the following:

1. **RivalMetrics** — Comprehensive attribution modeling, strong for performance marketing teams.
2. **DataBridge** — Excellent real-time dashboards, works well with Google Analytics data.
3. **Looker (Google)** — Powerful BI tool if you're already in the Google ecosystem.
4. **Tableau** — Best-in-class visualizations for complex data needs.

When choosing, consider: team size, tech stack compatibility, budget, and whether you need real-time vs. batch reporting.`,
  },
  // Prompt 3 — awareness, brand mentioned neutrally at rank 3
  {
    brandMentioned: true,
    sentiment: "NEUTRAL" as Sentiment,
    mentionRank: 3,
    competitorsMentioned: ["InsightCo", "DataBridge"],
    responseText: `Top B2B marketing analytics companies in 2025:

1. **InsightCo** — Dominant in enterprise ABM analytics with strong Salesforce integration.
2. **DataBridge** — Known for its data pipeline reliability and real-time capabilities.
3. **Acme Corp** — Growing presence in mid-market, recognized for AI-driven recommendations.
4. **Marketo Engage** — Adobe's offering, deeply integrated with their Creative Cloud suite.

The market has fragmented significantly, with AI-native platforms gaining ground against legacy vendors.`,
  },
  // Prompt 4 — comparison, brand mentioned positively at rank 1
  {
    brandMentioned: true,
    sentiment: "POSITIVE" as Sentiment,
    mentionRank: 1,
    competitorsMentioned: [],
    responseText: `Yes, Acme Corp is well-regarded for multi-channel marketing attribution. Here's what makes it stand out:

**Strengths for attribution:**
- Data-driven attribution models (not just last-click)
- Supports 150+ channel integrations including paid, organic, email, and social
- Real-time attribution updates as campaigns run
- Clean visual journey mapping across touchpoints

**Limitations to consider:**
- Requires clean UTM tagging across all channels
- The custom attribution model builder has a learning curve
- Offline attribution (events, print) requires manual data import

**Bottom line**: If you're already tracking digital channels carefully, Acme Corp's attribution engine is one of the best in the mid-market. Several users on G2 and Capterra specifically call out the attribution accuracy as a key differentiator.`,
  },
];

// Citation URLs seeded per mention — keyed by prompt index
const CITATION_SOURCES: Record<
  number,
  Array<{ url: string; domain: string; isOwned: boolean }>
> = {
  0: [
    { url: "https://acmecorp.com/blog/crm-for-small-business", domain: "acmecorp.com", isOwned: true },
    { url: "https://g2.com/products/acme-corp/reviews", domain: "g2.com", isOwned: false },
  ],
  1: [
    { url: "https://acmecorp.com/vs/rivalmetrics", domain: "acmecorp.com", isOwned: true },
    { url: "https://capterra.com/software/acme-corp", domain: "capterra.com", isOwned: false },
    { url: "https://techradar.com/best-analytics-platforms", domain: "techradar.com", isOwned: false },
  ],
  2: [],
  3: [
    { url: "https://acmecorp.com/product", domain: "acmecorp.com", isOwned: true },
  ],
  4: [
    { url: "https://acmecorp.com/features/attribution", domain: "acmecorp.com", isOwned: true },
    { url: "https://g2.com/products/acme-corp", domain: "g2.com", isOwned: false },
  ],
};

// Distribute 20 mentions across 5 prompts × multiple platforms
// promptIdx → platforms to use for that prompt
const MENTION_DISTRIBUTION: Array<{ promptIdx: number; platforms: Platform[] }> = [
  { promptIdx: 0, platforms: ["CHATGPT", "PERPLEXITY", "GEMINI", "GOOGLE_AI_OVERVIEWS"] },
  { promptIdx: 1, platforms: ["CHATGPT", "PERPLEXITY", "COPILOT", "GEMINI"] },
  { promptIdx: 2, platforms: ["CHATGPT", "GEMINI"] },
  { promptIdx: 3, platforms: ["PERPLEXITY", "GOOGLE_AI_OVERVIEWS", "GROK"] },
  { promptIdx: 4, platforms: ["CHATGPT", "COPILOT", "PERPLEXITY", "GROK", "GEMINI"] },
];
// Total: 4 + 4 + 2 + 3 + 5 = 18, pad to 20 by duplicating two
const EXTRA_MENTIONS: Array<{ promptIdx: number; platforms: Platform[] }> = [
  { promptIdx: 0, platforms: ["COPILOT"] },
  { promptIdx: 2, platforms: ["COPILOT"] },
];

// ─── Main seed function ───────────────────────────────────────

async function main() {
  console.log("🌱 Seeding database…");

  // Clean up existing demo data
  await prisma.citation.deleteMany({});
  await prisma.mention.deleteMany({});
  await prisma.prompt.deleteMany({});
  await prisma.competitor.deleteMany({});
  await prisma.contentBrief.deleteMany({});
  await prisma.auditReport.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({ where: { email: "demo@example.com" } });

  // ── 1. Create demo user ───────────────────────────────────
  const hashedPassword = await bcrypt.hash("demo1234", 12);

  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email: "demo@example.com",
      password: hashedPassword,
      plan: "GROWTH",
      emailVerified: new Date(),
    },
  });
  console.log(`  ✓ User created: ${user.email}`);

  // ── 2. Create project ─────────────────────────────────────
  const project = await prisma.project.create({
    data: {
      name: "Acme Corp — Main",
      brandName: "Acme Corp",
      websiteUrl: "https://acmecorp.com",
      userId: user.id,
    },
  });
  console.log(`  ✓ Project created: ${project.name}`);

  // ── 3. Create competitors ─────────────────────────────────
  await prisma.competitor.createMany({
    data: COMPETITORS.map((c) => ({ ...c, projectId: project.id })),
  });
  console.log(`  ✓ ${COMPETITORS.length} competitors created`);

  // ── 4. Create prompts ─────────────────────────────────────
  const createdPrompts = await Promise.all(
    PROMPTS.map((p) =>
      prisma.prompt.create({
        data: { ...p, projectId: project.id },
      })
    )
  );
  console.log(`  ✓ ${createdPrompts.length} prompts created`);

  // ── 5. Create mentions (20 total) ────────────────────────
  const allDistributions = [...MENTION_DISTRIBUTION, ...EXTRA_MENTIONS];
  let mentionCount = 0;
  let citationCount = 0;
  let hoursOffset = 0;

  for (const dist of allDistributions) {
    const template = RESPONSE_TEMPLATES[dist.promptIdx];
    const prompt = createdPrompts[dist.promptIdx];

    for (const platform of dist.platforms) {
      // Vary sentiment slightly for non-primary platforms
      const sentiment: Sentiment =
        platform === "CHATGPT"
          ? template.sentiment
          : template.brandMentioned
          ? pick<Sentiment>(["POSITIVE", "NEUTRAL"])
          : "NOT_MENTIONED";

      const mention = await prisma.mention.create({
        data: {
          promptId: prompt.id,
          projectId: project.id,
          platform,
          brandMentioned: template.brandMentioned,
          competitorsMentioned: template.competitorsMentioned,
          sentiment,
          responseText: template.responseText,
          mentionRank: template.mentionRank ?? null,
          createdAt: hoursAgo(hoursOffset),
        },
      });
      mentionCount++;
      hoursOffset += 3; // spread mentions across time

      // Create citations for this mention
      const citationSources = CITATION_SOURCES[dist.promptIdx] ?? [];
      for (const source of citationSources) {
        await prisma.citation.create({
          data: {
            mentionId: mention.id,
            projectId: project.id,
            url: source.url,
            domain: source.domain,
            isOwned: source.isOwned,
            platform,
            createdAt: mention.createdAt,
          },
        });
        citationCount++;
      }
    }
  }
  console.log(`  ✓ ${mentionCount} mentions created`);
  console.log(`  ✓ ${citationCount} citations created`);

  // ── 6. Create an audit report ────────────────────────────
  await prisma.auditReport.create({
    data: {
      projectId: project.id,
      url: "https://acmecorp.com",
      overallScore: 68,
      crawlabilityScore: 85,
      schemaScore: 40,
      contentScore: 72,
      authorityScore: 75,
      robotsTxtBlocking: false,
      schemaTypesFound: ["Organization", "WebSite", "BreadcrumbList"],
      recommendations: [
        {
          priority: "high",
          issue: "Missing FAQ schema on key landing pages",
          fix: "Add FAQPage JSON-LD schema to /features, /pricing, and /blog pages",
        },
        {
          priority: "high",
          issue: "Author bios absent from blog posts",
          fix: "Add Person schema with expertise signals to all blog author pages",
        },
        {
          priority: "medium",
          issue: "Product/Service schema missing",
          fix: "Add SoftwareApplication or Product schema to the main product pages",
        },
        {
          priority: "medium",
          issue: "No HowTo schema on tutorial pages",
          fix: "Implement HowTo schema on the 6 tutorial/guide pages",
        },
        {
          priority: "low",
          issue: "Date metadata inconsistent",
          fix: "Ensure all pages have consistent datePublished and dateModified meta tags",
        },
      ],
      rawData: {
        crawledPages: 47,
        pagesWithSchema: 12,
        averageWordCount: 1240,
        internalLinks: 312,
        externalLinksToPage: 89,
      },
      createdAt: daysAgo(2),
    },
  });
  console.log("  ✓ Audit report created");

  // ── 7. Create content briefs ────────────────────────────
  const briefs = [
    {
      topic: "Why enterprise analytics tools fail mid-market teams",
      promptText: "What analytics platform should I buy for my marketing team?",
      status: "GENERATED" as BriefStatus,
      briefContent: {
        title: "Why enterprise analytics tools fail mid-market teams (and what to use instead)",
        targetKeywords: ["marketing analytics for mid-market", "best analytics platform 2025"],
        wordCount: 2200,
        sections: [
          { heading: "The enterprise analytics gap", summary: "Explain why tools built for F500 companies overwhelm mid-market teams" },
          { heading: "What mid-market teams actually need", summary: "Speed, self-serve, fewer integrations to maintain" },
          { heading: "Comparison: Enterprise vs purpose-built mid-market tools", summary: "Side-by-side feature and pricing comparison" },
          { heading: "How to evaluate analytics platforms in 2025", summary: "Framework with 5 criteria" },
        ],
        faqs: [
          "What is the best marketing analytics platform for a 20-person team?",
          "How much should a mid-market company spend on analytics software?",
          "Can I replace Google Analytics with a dedicated analytics platform?",
        ],
        entities: ["Acme Corp", "marketing attribution", "multi-touch attribution", "B2B analytics"],
        schemaType: "Article",
      },
      schemaMarkup: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Why enterprise analytics tools fail mid-market teams",
        "author": { "@type": "Organization", "name": "Acme Corp" },
        "publisher": { "@type": "Organization", "name": "Acme Corp", "url": "https://acmecorp.com" },
      }, null, 2),
      createdAt: daysAgo(5),
    },
    {
      topic: "Multi-channel marketing attribution: complete guide",
      promptText: "Is Acme Corp good for tracking multi-channel marketing attribution?",
      status: "GENERATED" as BriefStatus,
      briefContent: {
        title: "Multi-channel marketing attribution: the complete guide for 2025",
        targetKeywords: ["multi-channel attribution", "marketing attribution software", "attribution modeling"],
        wordCount: 3100,
        sections: [
          { heading: "What is multi-channel attribution?", summary: "Definition and why it matters" },
          { heading: "Attribution models compared", summary: "Last-click, first-click, linear, time-decay, data-driven" },
          { heading: "Setting up attribution tracking", summary: "UTM parameters, pixel tracking, CRM data" },
          { heading: "Common attribution mistakes", summary: "Top 5 mistakes teams make" },
        ],
        faqs: [
          "What is the most accurate marketing attribution model?",
          "How do I track attribution across offline and online channels?",
          "What data do I need for data-driven attribution?",
        ],
        entities: ["marketing attribution", "UTM parameters", "conversion tracking", "ROI"],
        schemaType: "Article",
      },
      schemaMarkup: null,
      createdAt: daysAgo(3),
    },
    {
      topic: "Acme Corp vs RivalMetrics: 2025 comparison",
      promptText: "Compare Acme Corp vs RivalMetrics for enterprise analytics",
      status: "PENDING" as BriefStatus,
      briefContent: Prisma.JsonNull,
      schemaMarkup: null,
      createdAt: daysAgo(1),
    },
  ];

  await prisma.contentBrief.createMany({ data: briefs.map((b) => ({ ...b, projectId: project.id })) });
  console.log(`  ✓ ${briefs.length} content briefs created`);

  // ── 8. Seed SUPERADMIN ───────────────────────────────
  const superAdminEmail = process.env.SUPERADMIN_EMAIL;
  if (superAdminEmail) {
    const existing = await prisma.user.findUnique({ where: { email: superAdminEmail } });
    if (existing) {
      await prisma.user.update({
        where: { email: superAdminEmail },
        data: { adminRole: AdminRole.SUPERADMIN },
      });
      console.log(`  ✓ SUPERADMIN role granted to: ${superAdminEmail}`);
    } else {
      // Create the account so they can sign in with OAuth or credentials
      await prisma.user.create({
        data: {
          email: superAdminEmail,
          name: "Admin",
          adminRole: AdminRole.SUPERADMIN,
          plan: "FREE",
        },
      });
      console.log(`  ✓ SUPERADMIN account created: ${superAdminEmail}`);
    }
  } else {
    console.log("  ⚠  SUPERADMIN_EMAIL not set — skipping superadmin seed");
  }

  console.log("\n✅ Seed complete!");
  console.log("   Login: demo@example.com / demo1234");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
