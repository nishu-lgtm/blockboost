// Shared client-safe types for the Citations dashboard.
// Keep in sync with app/api/citations/[projectId]/route.ts

export interface OwnedPageRow {
  url: string;
  domain: string;
  count: number;
  platforms: string[];
}

export interface ThirdPartyRow {
  domain: string;
  count: number;
  category: "authoritative" | "review" | "social" | "news" | "other";
  platforms: string[];
}

export interface TimelinePoint {
  date: string;
  owned: number;
  thirdParty: number;
}

export interface PlatformDomainRow {
  platform: string;
  topDomains: Array<{ domain: string; count: number }>;
}

export interface HallucinationAlert {
  platform: string;
  claim: string;
  severity: "high" | "medium" | "low";
}

export interface CitationSummary {
  total: number;
  owned: number;
  thirdParty: number;
  mostCitedPlatform: string | null;
  ownedRate: number;
}

export interface CitationsData {
  projectId: string;
  brandName: string;
  days: number;
  summary: CitationSummary;
  ownedPages: OwnedPageRow[];
  thirdPartyDomains: ThirdPartyRow[];
  timeline: TimelinePoint[];
  platformPreferences: PlatformDomainRow[];
  hallucinationAlerts: HallucinationAlert[];
}
