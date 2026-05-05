/**
 * Social Scanner — discovers Reddit, Quora, and LinkedIn opportunities
 * where a business reply could get cited by AI platforms.
 */

import { prisma } from "@/lib/prisma";
import { SocialPlatform } from "@prisma/client";

// ─── Business category → subreddit mapping ───────────────────────────────────

export const CATEGORY_SUBREDDITS: Record<string, string[]> = {
  dental: [
    "Dentistry", "askdentists", "DentalHygiene", "personalfinance",
    "AskDocs", "teeth",
  ],
  legal: [
    "legaladvice", "AskALawyer", "personalinjury", "LegalAdviceUK",
    "divorce", "landlord",
  ],
  restaurant: [
    "AskCulinary", "food", "FoodNYC", "austinfood", "Seattle",
    "chicago", "Cooking",
  ],
  home_services: [
    "HomeImprovement", "DIY", "Plumbing", "electricians", "HVAC",
    "Roofing", "handyman",
  ],
  medical: [
    "AskDocs", "medicine", "HealthInsurance", "medical", "nursing",
    "PrimaryCare",
  ],
  fitness: [
    "fitness", "xxfitness", "homegym", "bodyweightfitness",
    "personaltraining", "yoga",
  ],
  beauty: [
    "beauty", "MakeupAddiction", "SkincareAddiction", "Hair",
    "femalefashionadvice",
  ],
  real_estate: [
    "RealEstate", "FirstTimeHomeBuyer", "realestateinvesting",
    "personalfinance", "homebuying",
  ],
  accounting: [
    "tax", "personalfinance", "smallbusiness", "Accounting",
    "Entrepreneur", "SelfEmployed",
  ],
  veterinary: [
    "AskVet", "dogs", "cats", "Pets", "puppy", "CatAdvice",
  ],
  education: [
    "education", "Teachers", "tutors", "homeschool", "SAT",
    "ACT", "college",
  ],
  auto: [
    "MechanicAdvice", "caradvice", "AutoRepair", "whatcarshouldibuy",
    "askcarsales",
  ],
  financial: [
    "personalfinance", "financialplanning", "investing",
    "Bogleheads", "Fire", "ChubbyFIRE",
  ],
  marketing: [
    "marketing", "SEO", "digital_marketing", "socialmedia",
    "PPC", "Entrepreneur",
  ],
  technology: [
    "sysadmin", "webdev", "programming", "techsupport",
    "smallbusiness", "startups",
  ],
  childcare: [
    "Parenting", "beyondthebump", "NewParents", "toddlers",
    "Mommit", "daddit",
  ],
  wedding: [
    "weddingplanning", "weddingplanning", "wedding",
    "Brides", "weddingvideography",
  ],
  travel: [
    "travel", "solotravel", "shoestring", "backpacking",
    "TravelHacks", "digitalnomad",
  ],
  photography: [
    "photography", "photojournalism", "weddingphotography",
    "portraits", "Cameras",
  ],
  consulting: [
    "consulting", "MBAgrants", "careeradvice", "Entrepreneur",
    "startups", "business",
  ],
};

// City → local subreddits
const CITY_SUBREDDITS: Record<string, string[]> = {
  "austin": ["Austin", "austinfood", "AustinJobs"],
  "new york": ["nyc", "FoodNYC", "AskNYC", "nycjobs"],
  "los angeles": ["LosAngeles", "AskLosAngeles", "LAlist"],
  "chicago": ["chicago", "AskChicago", "ChicagoJobs"],
  "seattle": ["Seattle", "seattlewa", "SeattleJobs"],
  "san francisco": ["sanfrancisco", "AskSF", "SFJobs"],
  "denver": ["Denver", "denverfood", "DenverJobs"],
  "miami": ["Miami", "AskMiami", "miamifood"],
  "boston": ["boston", "AskBoston", "BostonJobs"],
  "atlanta": ["Atlanta", "AskAtlanta", "atlantafood"],
  "dallas": ["Dallas", "DFWMetro", "dallasjobs"],
  "phoenix": ["phoenix", "AskPhoenix", "PHXJobs"],
  "portland": ["Portland", "AskPortland", "PortlandFood"],
  "minneapolis": ["Minneapolis", "TwinCities"],
  "houston": ["houston", "AskHouston"],
};

// ─── AI citation probability calculator ──────────────────────────────────────

export function calcAICitationProbability(post: {
  upvotes: number;
  commentCount: number;
  subredditSize?: number;
  title: string;
}): number {
  let score = 0;

  // Factor 1: Upvotes (0–25)
  if (post.upvotes >= 100) score += 25;
  else if (post.upvotes >= 50) score += 15;
  else if (post.upvotes >= 10) score += 8;
  else score += 2;

  // Factor 2: Comment count (0–25)
  if (post.commentCount >= 20) score += 25;
  else if (post.commentCount >= 10) score += 15;
  else if (post.commentCount >= 5) score += 8;
  else score += 2;

  // Factor 3: Subreddit size estimate (0–25)
  const size = post.subredditSize ?? 0;
  if (size >= 1_000_000) score += 25;
  else if (size >= 100_000) score += 15;
  else if (size >= 10_000) score += 8;
  else score += 3;

  // Factor 4: Question intent (0–25)
  const title = post.title.toLowerCase();
  const questionPhrases = [
    "best", "who", "where", "what", "recommend", "looking for",
    "suggestions", "advice", "anyone know", "need a", "find a",
    "good dentist", "good lawyer", "good doctor", "good plumber",
  ];
  if (questionPhrases.some((p) => title.includes(p))) {
    score += 25;
  } else if (title.includes("?")) {
    score += 10;
  }

  return Math.min(100, score);
}

// ─── Reddit Scanner ───────────────────────────────────────────────────────────

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  subreddit_subscribers: number;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
}

async function getRedditToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "BlockBoost/1.0",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

async function searchReddit(
  token: string,
  query: string,
  subreddit?: string,
  sort = "new",
  limit = 25
): Promise<RedditPost[]> {
  const base = subreddit
    ? `https://oauth.reddit.com/r/${subreddit}/search.json`
    : "https://oauth.reddit.com/search.json";

  const params = new URLSearchParams({
    q: query,
    sort,
    limit: String(limit),
    t: "week",
    type: "link",
    ...(subreddit ? { restrict_sr: "1" } : {}),
  });

  const res = await fetch(`${base}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "BlockBoost/1.0",
    },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    data?: {
      children?: Array<{ data: RedditPost }>;
    };
  };
  return data.data?.children?.map((c) => c.data) ?? [];
}

async function scoreRelevance(
  post: RedditPost,
  businessCategory: string,
  city: string,
  brandName: string
): Promise<number> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: keyword-based scoring
    const text = `${post.title} ${post.selftext}`.toLowerCase();
    const cityMatch = city && text.includes(city.toLowerCase()) ? 30 : 0;
    const catMatch = text.includes(businessCategory.toLowerCase()) ? 40 : 0;
    const questionMatch = text.includes("?") || text.includes("recommend") ? 30 : 0;
    return Math.min(100, cityMatch + catMatch + questionMatch);
  }

  const prompt = `Rate 0-100 how relevant this Reddit post is for a "${businessCategory}" business in "${city}" to reply to.

Post title: ${post.title}
Post body: ${post.selftext.slice(0, 500)}

Consider:
- Is this person looking for a recommendation?
- Are they in or near ${city}?
- Would a "${businessCategory}" business have genuinely helpful information to share?
- Is this a real opportunity to help (not a spam/bot post)?

Reply with ONLY a number 0-100. No explanation.`;

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 5,
      temperature: 0,
    });
    const score = parseInt(resp.choices[0]?.message?.content?.trim() ?? "0", 10);
    return isNaN(score) ? 0 : Math.min(100, Math.max(0, score));
  } catch {
    return 50;
  }
}

export async function scanReddit(projectId: string): Promise<number> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      socialSettings: true,
      prompts: { select: { text: true }, take: 20 },
    },
  });
  if (!project) return 0;

  const settings = project.socialSettings;
  if (settings && !settings.redditEnabled) return 0;

  const token = await getRedditToken();
  if (!token) {
    console.warn("[social-scanner] No Reddit credentials configured");
    return 0;
  }

  // Build keyword list from settings + prompts
  const keywordsFromPrompts = project.prompts
    .map((p) => p.text.split(" ").slice(0, 5).join(" "))
    .slice(0, 5);
  const monitorKeywords = settings?.monitorKeywords?.length
    ? settings.monitorKeywords
    : [project.brandName, ...keywordsFromPrompts];

  // Category-based subreddits + city subreddits
  const category = (project as { businessCategory?: string }).businessCategory ?? "general";
  const city = ((project as { city?: string }).city ?? "").toLowerCase();
  const categoryReddits = CATEGORY_SUBREDDITS[category] ?? [];
  const cityReddits = CITY_SUBREDDITS[city] ?? [];
  const targetSubreddits = [
    ...(settings?.targetSubreddits ?? []),
    ...categoryReddits.slice(0, 3),
    ...cityReddits.slice(0, 2),
  ].filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate

  const allPosts: RedditPost[] = [];
  const seen = new Set<string>();

  // Search by keyword across Reddit
  for (const keyword of monitorKeywords.slice(0, 5)) {
    const posts = await searchReddit(token, keyword, undefined, "new", 25);
    for (const p of posts) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        allPosts.push(p);
      }
    }
  }

  // Search by subreddit + keyword
  for (const subreddit of targetSubreddits.slice(0, 5)) {
    for (const keyword of monitorKeywords.slice(0, 3)) {
      const posts = await searchReddit(token, keyword, subreddit, "new", 10);
      for (const p of posts) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          allPosts.push(p);
        }
      }
    }
  }

  let saved = 0;
  const minScore = settings?.minimumAICitationScore ?? 40;

  for (const post of allPosts) {
    // Skip excluded keywords
    const exclude = settings?.excludeKeywords ?? [];
    const postText = `${post.title} ${post.selftext}`.toLowerCase();
    if (exclude.some((kw) => postText.includes(kw.toLowerCase()))) continue;

    // Skip if below minimum upvotes
    if (post.score < (settings?.minimumUpvotes ?? 5)) continue;

    const aiScore = calcAICitationProbability({
      upvotes: post.score,
      commentCount: post.num_comments,
      subredditSize: post.subreddit_subscribers,
      title: post.title,
    });

    if (aiScore < minScore) continue;

    const relevance = await scoreRelevance(
      post,
      category,
      city,
      project.brandName
    );

    if (relevance < 30) continue;

    const matchedKeywords = monitorKeywords.filter((kw) =>
      postText.includes(kw.toLowerCase())
    );

    const postUrl = `https://reddit.com${post.permalink}`;

    try {
      await prisma.socialOpportunity.upsert({
        where: { projectId_url: { projectId, url: postUrl } },
        create: {
          projectId,
          platform: SocialPlatform.REDDIT,
          url: postUrl,
          title: post.title.slice(0, 300),
          body: post.selftext.slice(0, 2000),
          author: post.author,
          subreddit: post.subreddit,
          upvotes: post.score,
          commentCount: post.num_comments,
          aiCitationProbability: aiScore,
          relevanceScore: relevance,
          keywords: matchedKeywords,
          externalId: post.id,
        },
        update: {
          upvotes: post.score,
          commentCount: post.num_comments,
          aiCitationProbability: aiScore,
        },
      });
      saved++;
    } catch {
      // Already exists or constraint — skip
    }
  }

  return saved;
}

// ─── Quora Scanner (via Apify) ────────────────────────────────────────────────

export async function scanQuora(projectId: string): Promise<number> {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.warn("[social-scanner] No Apify token configured for Quora");
    return 0;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { socialSettings: true, prompts: { select: { text: true }, take: 10 } },
  });
  if (!project) return 0;
  if (project.socialSettings && !project.socialSettings.quoraEnabled) return 0;

  const keywords = project.socialSettings?.monitorKeywords?.slice(0, 3) ??
    [project.brandName];
  const category = (project as { businessCategory?: string }).businessCategory ?? "general";
  const city = (project as { city?: string }).city ?? "";

  let saved = 0;

  for (const keyword of keywords) {
    try {
      // Start Apify actor run
      const startRes = await fetch(
        `https://api.apify.com/v2/acts/quora-scraper/runs?token=${apifyToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queries: [`${keyword} ${city}`.trim()],
            maxResults: 20,
          }),
        }
      );
      if (!startRes.ok) continue;

      const run = (await startRes.json()) as { data?: { id?: string } };
      const runId = run.data?.id;
      if (!runId) continue;

      // Poll for completion (max 30s)
      let items: QuoraItem[] = [];
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const dataRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}&limit=20`
        );
        if (dataRes.ok) {
          items = (await dataRes.json()) as QuoraItem[];
          if (items.length > 0) break;
        }
      }

      for (const item of items) {
        if (!item.url || !item.question) continue;
        if ((item.viewCount ?? 0) < 100) continue;

        const aiScore = calcAICitationProbability({
          upvotes: item.upvotes ?? 0,
          commentCount: item.answerCount ?? 0,
          title: item.question,
        });

        const minScore = project.socialSettings?.minimumAICitationScore ?? 40;
        if (aiScore < minScore) continue;

        try {
          await prisma.socialOpportunity.upsert({
            where: { projectId_url: { projectId, url: item.url } },
            create: {
              projectId,
              platform: SocialPlatform.QUORA,
              url: item.url,
              title: item.question.slice(0, 300),
              body: (item.body ?? "").slice(0, 2000),
              author: item.author ?? "Anonymous",
              upvotes: item.upvotes ?? 0,
              commentCount: item.answerCount ?? 0,
              aiCitationProbability: aiScore,
              relevanceScore: 60, // Quora questions are generally high relevance
              keywords: [keyword],
            },
            update: {
              upvotes: item.upvotes ?? 0,
              commentCount: item.answerCount ?? 0,
            },
          });
          saved++;
        } catch {
          // Skip duplicate
        }
      }
    } catch (err) {
      console.error("[social-scanner] Quora scan error:", err);
    }
  }

  return saved;
}

interface QuoraItem {
  url?: string;
  question?: string;
  body?: string;
  author?: string;
  upvotes?: number;
  answerCount?: number;
  viewCount?: number;
}

// ─── LinkedIn Scanner (via Apify) ─────────────────────────────────────────────

export async function scanLinkedIn(projectId: string): Promise<number> {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.warn("[social-scanner] No Apify token for LinkedIn");
    return 0;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { socialSettings: true },
  });
  if (!project) return 0;
  if (project.socialSettings && !project.socialSettings.linkedinEnabled) return 0;

  const keywords = project.socialSettings?.monitorKeywords?.slice(0, 3) ??
    [project.brandName];
  let saved = 0;

  for (const keyword of keywords) {
    try {
      const startRes = await fetch(
        `https://api.apify.com/v2/acts/linkedin-scraper/runs?token=${apifyToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ searchQueries: [keyword], maxResults: 15 }),
        }
      );
      if (!startRes.ok) continue;

      const run = (await startRes.json()) as { data?: { id?: string } };
      const runId = run.data?.id;
      if (!runId) continue;

      // Poll
      let items: LinkedInItem[] = [];
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const dataRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}&limit=15`
        );
        if (dataRes.ok) {
          items = (await dataRes.json()) as LinkedInItem[];
          if (items.length > 0) break;
        }
      }

      for (const item of items) {
        if (!item.url || (item.reactions ?? 0) < 10) continue;

        const aiScore = calcAICitationProbability({
          upvotes: item.reactions ?? 0,
          commentCount: item.comments ?? 0,
          title: item.title ?? item.text?.slice(0, 100) ?? "",
        });

        const minScore = project.socialSettings?.minimumAICitationScore ?? 40;
        if (aiScore < minScore) continue;

        try {
          await prisma.socialOpportunity.upsert({
            where: { projectId_url: { projectId, url: item.url } },
            create: {
              projectId,
              platform: SocialPlatform.LINKEDIN,
              url: item.url,
              title: (item.title ?? item.text?.slice(0, 100) ?? "LinkedIn post").slice(0, 300),
              body: (item.text ?? "").slice(0, 2000),
              author: item.author ?? "LinkedIn user",
              upvotes: item.reactions ?? 0,
              commentCount: item.comments ?? 0,
              aiCitationProbability: aiScore,
              relevanceScore: 55,
              keywords: [keyword],
            },
            update: { upvotes: item.reactions ?? 0 },
          });
          saved++;
        } catch {
          // Skip duplicate
        }
      }
    } catch (err) {
      console.error("[social-scanner] LinkedIn scan error:", err);
    }
  }

  return saved;
}

interface LinkedInItem {
  url?: string;
  title?: string;
  text?: string;
  author?: string;
  reactions?: number;
  comments?: number;
}

// ─── Full project scan ────────────────────────────────────────────────────────

export async function scanProject(projectId: string): Promise<{
  reddit: number;
  quora: number;
  linkedin: number;
}> {
  const [reddit, quora, linkedin] = await Promise.all([
    scanReddit(projectId),
    scanQuora(projectId),
    scanLinkedIn(projectId),
  ]);

  return { reddit, quora, linkedin };
}
