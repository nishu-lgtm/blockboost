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

// Sprint 1 step 5: mention rate per QueryIntent bucket.
// `intent` is the QueryIntent enum value (DISCOVERY | COMPARISON | …).
// `commercialWeight` mirrors INTENT_COMMERCIAL_WEIGHT for UI sorting +
// the "high commercial-intent visibility" KPI.
export interface IntentRate {
  intent: string;
  label: string;
  rate: number;          // 0-100, percent
  mentionCount: number;  // brand mentions in this bucket
  totalCount: number;    // total mentions in this bucket
  commercialWeight: number; // 0-1, used to weight the headline KPI
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
  mentionRateByIntent: IntentRate[];
  promptBreakdown: PromptRow[];
  sentimentBreakdown: SentimentBreakdown;
}
