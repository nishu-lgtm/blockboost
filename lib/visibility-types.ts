// Shared client-safe types for the visibility dashboard.
// Keep in sync with app/api/visibility/[projectId]/route.ts

export interface PlatformRate {
  platform: string;
  rate: number;
  mentionCount: number;
  totalCount: number;
}

export interface TimeSeriesPoint {
  date: string;
  [platform: string]: number | string;
}

export interface PromptResult {
  platform: string;
  mentioned: boolean;
  responseText: string;
  sentiment: string;
  mentionRank: number | null;
}

export interface PromptRow {
  promptId: string;
  promptText: string;
  category: string;
  results: PromptResult[];
  avgMentionRate: number;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface SummaryMetrics {
  overallRate: number;
  bestPlatform: string | null;
  totalCitations: number;
  shareOfVoice: number;
}

export interface VisibilityData {
  projectId: string;
  projectName: string;
  brandName: string;
  lastScanAt: string | null;
  summaryMetrics: SummaryMetrics;
  mentionRateByPlatform: PlatformRate[];
  mentionRateOverTime: TimeSeriesPoint[];
  promptBreakdown: PromptRow[];
  sentimentBreakdown: SentimentBreakdown;
}
