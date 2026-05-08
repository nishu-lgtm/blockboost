// Shared client-safe types for the Competitor Intelligence dashboard.

export interface CompetitorInfo {
  id: string;
  brandName: string;
  websiteUrl: string | null;
}

// Share of Voice per platform
export interface SoVPlatformBar {
  platform: string;
  [brand: string]: number | string; // brand → mention %, "platform" key is the label
}

// Head-to-head per prompt
export interface H2HPromptRow {
  promptId: string;
  promptText: string;
  category: string;
  // keyed by brand name → mentioned boolean
  results: Record<string, boolean>;
  // "win" | "loss" | "tie" | "empty"
  outcome: "win" | "loss" | "tie" | "empty";
}

export interface H2HSummary {
  // brand name → win rate 0-100
  winRates: Record<string, number>;
}

// Trend over time
export interface TrendPoint {
  date: string; // YYYY-MM-DD
  [brand: string]: number | string; // brand → mention rate
}

// Prompt gap (competitor appears, you don't)
export interface GapRow {
  promptId: string;
  promptText: string;
  competitorsPresent: string[]; // competitor brand names that appeared
}

// Competitor citation sources
export interface CitationSourceRow {
  brand: string; // your brand or competitor brand name
  domains: Array<{ domain: string; count: number }>;
}

// Full API response
export interface CompetitorData {
  projectId: string;
  brandName: string;
  competitors: CompetitorInfo[];
  planLimit: number;
  sovByPlatform: SoVPlatformBar[];
  allBrands: string[]; // [yourBrand, ...competitorBrands] — defines colors
  h2hRows: H2HPromptRow[];
  h2hSummary: H2HSummary;
  trendData: TrendPoint[];
  gapRows: GapRow[];
  citationSources: CitationSourceRow[];
}
