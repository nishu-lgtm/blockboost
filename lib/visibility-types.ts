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
  // Sprint 2: aggregate confidence of the headline rate.
  // "high"   = ≥80% of mentions came from multi-pass (N≥3, majority agreement)
  // "medium" = mixed signal (some single-shot, some multi-pass)
  // "low"    = mostly single-shot scans (N=1) — UI should warn
  confidence: "high" | "medium" | "low";
}

export interface VisibilitySegmentLite {
  promptCount: number;
  totalScans: number;
  citedScans: number;
  mentionRate: number;
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
  /**
   * Branded vs unbranded segmentation (added 2026-05-16).
   *
   * Branded = prompt text contains the brand name → engagement signal.
   * Unbranded = generic competitive prompts → real discovery signal.
   * weightedScore = 0.7 × unbranded + 0.3 × branded, anchored on the harder
   * unbranded number which is what "AI Visibility" actually means.
   */
  segments?: {
    branded: VisibilitySegmentLite;
    unbranded: VisibilitySegmentLite;
    weightedScore: number;
  };
}
