// Shared client-safe types for the AEO Audit tool.

export type ScoreLevel = "good" | "warning" | "bad";

export interface CheckItem {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  scoreImpact?: number;
}

export interface CrawlabilitySection {
  score: number; // 0-100
  aiCrawlerAccess: CheckItem;
  httpsEnabled: CheckItem;
  pageSpeed: CheckItem & { lcp?: number; fcp?: number; ttfb?: number };
  jsRequired: CheckItem;
  robotsTxtBlocking: boolean;
  blockedBots: string[];
}

export interface SchemaSection {
  score: number;
  typesFound: string[];
  typesChecked: Array<{
    type: string;
    present: boolean;
    recommendation: string;
  }>;
  rawSchemas: string[]; // JSON strings of found schemas
}

export interface ContentSection {
  score: number;
  wordCount: number;
  readingLevel: string;
  directAnswer: CheckItem;
  questionHeadings: CheckItem;
  faqSection: CheckItem;
  factDensity: CheckItem;
}

export interface AuthoritySection {
  score: number;
  authorBio: CheckItem;
  externalLinks: CheckItem & { count?: number };
  publicationDate: CheckItem;
  socialProof: CheckItem;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  category: "crawlability" | "schema" | "content" | "authority";
  issue: string;
  action: string;
  scoreImpact: number;
}

export interface AuditResult {
  id: string;
  url: string;
  auditedAt: string;
  overallScore: number;
  crawlabilityScore: number;
  schemaScore: number;
  contentScore: number;
  authorityScore: number;
  crawlability: CrawlabilitySection;
  schema: SchemaSection;
  content: ContentSection;
  authority: AuthoritySection;
  recommendations: Recommendation[];
}

export interface RecentAudit {
  id: string;
  url: string;
  overallScore: number;
  createdAt: string;
}
