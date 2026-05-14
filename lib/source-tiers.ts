/**
 * Authority tiering for citation sources.
 *
 * Not all citations weigh the same:
 *   - A Wirecutter recommendation says "this is the best"
 *   - A Reddit thread mention says "someone on the internet thinks this"
 *
 * Both are real, but treating them as equal in mention-rate math produces
 * misleading visibility scores. We bucket each cited domain into one of five
 * tiers and expose `weightForTier()` so UI math + reports can be honest.
 *
 * Tiers (highest to lowest authority):
 *   premium     — top-of-funnel media + wirecutters of the world (1.0)
 *   authority   — niche but trusted (.gov / .edu / verticals)      (0.85)
 *   marketplace — review marketplaces (G2, Capterra, Trustpilot)   (0.7)
 *   forum       — community discussions (Reddit, Quora, HN)        (0.5)
 *   social      — short-form social posts (Twitter, TikTok)        (0.35)
 *   low         — unverified or low-trust                          (0.2)
 *
 * The list below is hand-curated. Bias: skewed to English-language tech +
 * commerce. Extend over time. Anything not matched gets `low`.
 */

export type Tier = "premium" | "authority" | "marketplace" | "forum" | "social" | "low";

export const TIER_WEIGHTS: Record<Tier, number> = {
  premium: 1.0,
  authority: 0.85,
  marketplace: 0.7,
  forum: 0.5,
  social: 0.35,
  low: 0.2,
};

export const TIER_LABELS: Record<Tier, string> = {
  premium: "Premium media",
  authority: "Authority",
  marketplace: "Marketplace / review",
  forum: "Forum / community",
  social: "Social",
  low: "Low / unverified",
};

// Exact-match domain → tier (most precise rules first)
const EXACT: Record<string, Tier> = {
  // Premium media
  "wirecutter.com": "premium",
  "nytimes.com": "premium",
  "wsj.com": "premium",
  "ft.com": "premium",
  "economist.com": "premium",
  "forbes.com": "premium",
  "bloomberg.com": "premium",
  "reuters.com": "premium",
  "techcrunch.com": "premium",
  "theverge.com": "premium",
  "wired.com": "premium",
  "engadget.com": "premium",
  "arstechnica.com": "premium",
  "cnet.com": "premium",
  "tomsguide.com": "premium",
  "tomshardware.com": "premium",
  "rtings.com": "premium",
  "consumerreports.org": "premium",
  "pcmag.com": "premium",
  "businessinsider.com": "premium",
  "fastcompany.com": "premium",
  "harvard.edu": "premium",
  "mit.edu": "premium",
  "stanford.edu": "premium",

  // Marketplace / review
  "g2.com": "marketplace",
  "capterra.com": "marketplace",
  "trustpilot.com": "marketplace",
  "trustradius.com": "marketplace",
  "softwaresuggest.com": "marketplace",
  "getapp.com": "marketplace",
  "producthunt.com": "marketplace",
  "yelp.com": "marketplace",
  "tripadvisor.com": "marketplace",
  "airbnb.com": "marketplace",

  // Forum / community
  "reddit.com": "forum",
  "quora.com": "forum",
  "stackoverflow.com": "forum",
  "stackexchange.com": "forum",
  "news.ycombinator.com": "forum",
  "indiehackers.com": "forum",

  // Social
  "twitter.com": "social",
  "x.com": "social",
  "linkedin.com": "social",
  "facebook.com": "social",
  "instagram.com": "social",
  "tiktok.com": "social",
  "youtube.com": "social",
  "pinterest.com": "social",
  "medium.com": "social",
  "substack.com": "social",
};

// Suffix-match rules (e.g. ".gov" → authority, ".edu" → authority)
const SUFFIX: Array<[string, Tier]> = [
  [".gov", "authority"],
  [".edu", "authority"],
  [".gov.uk", "authority"],
  [".ac.uk", "authority"],
  [".gov.in", "authority"],
];

// Substring match (last resort heuristic — e.g. *.medium.com → social)
const CONTAINS: Array<[string, Tier]> = [
  ["wikipedia", "authority"],
  ["amazon.", "marketplace"],
  ["ebay.", "marketplace"],
  ["reviews", "marketplace"],
];

/** Strip protocol + path; lowercase. */
export function normalizeDomain(input: string): string {
  try {
    const u = new URL(input.includes("://") ? input : `https://${input}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return input.toLowerCase().replace(/^www\./, "");
  }
}

export function tierForDomain(domain: string): Tier {
  const d = normalizeDomain(domain);
  if (EXACT[d]) return EXACT[d];

  for (const [suffix, tier] of SUFFIX) {
    if (d.endsWith(suffix)) return tier;
  }
  for (const [needle, tier] of CONTAINS) {
    if (d.includes(needle)) return tier;
  }
  return "low";
}

export function weightForDomain(domain: string): number {
  return TIER_WEIGHTS[tierForDomain(domain)];
}

/**
 * Compute a weighted mention rate from per-mention citation lists.
 * If a mention has no citations the weight defaults to 1.0 (we can't
 * downgrade a citation-less brand mention without context).
 */
export function weightedMentionRate(
  mentions: Array<{ brandMentioned: boolean; citations: Array<{ domain: string; isOwned: boolean }> }>
): { weighted: number; raw: number } {
  if (mentions.length === 0) return { weighted: 0, raw: 0 };
  const raw =
    Math.round((mentions.filter((m) => m.brandMentioned).length / mentions.length) * 1000) / 10;

  let weightSum = 0;
  let weightedHits = 0;
  for (const m of mentions) {
    // Use the highest-tier citation we have, or default to 1.0
    const w =
      m.citations.length > 0
        ? Math.max(...m.citations.filter((c) => !c.isOwned).map((c) => weightForDomain(c.domain)), 0.2)
        : 1.0;
    weightSum += w;
    if (m.brandMentioned) weightedHits += w;
  }
  const weighted =
    weightSum > 0 ? Math.round((weightedHits / weightSum) * 1000) / 10 : 0;

  return { weighted, raw };
}
