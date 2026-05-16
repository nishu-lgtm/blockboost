/**
 * Human-readable bucketing of percentage scores.
 *
 * Why this exists: showing "0%" to new users felt broken — the product
 * looked dead before any scan completed. ChatGPT product critique + user
 * feedback on 2026-05-16 both flagged the same issue ("never show 0%, it
 * feels broken"). This module converts raw 0-100 scores into:
 *
 *   "No data yet"   →  pre-scan, no signal at all
 *   "Low"            →  some data, weak presence
 *   "Medium"         →  moderate
 *   "Strong"         →  high
 *
 * Used by stat tiles on /dashboard, /dashboard/ai-visibility, and the
 * NextActionCard's score line.
 */

export type ScoreLabel = "No data yet" | "Low" | "Medium" | "Strong";
export type ScoreTone = "slate" | "red" | "amber" | "emerald";

export interface BucketedScore {
  /** The original numeric score (0-100), preserved for accessibility + tooltips. */
  score: number;
  /** Human-readable label that replaces "X%" in the headline. */
  label: ScoreLabel;
  /** Tailwind color family — UI picks the actual classes per design. */
  tone: ScoreTone;
  /** One-sentence "what this means" for the tile subtitle. */
  description: string;
  /** True when no scan data exists at all — UI should hide the % entirely. */
  noData: boolean;
}

/**
 * Bucket a 0-100 mention/visibility score.
 *
 * @param score        raw 0-100 percentage
 * @param totalSignals e.g. mention count. 0 means "no data" — distinct from
 *                     "0% but we have data" (which means "we scanned and
 *                     found nothing", a meaningful Low signal).
 */
export function bucketVisibilityScore(score: number, totalSignals: number): BucketedScore {
  if (totalSignals === 0) {
    return {
      score: 0,
      label: "No data yet",
      tone: "slate",
      description: "Run your first scan to see AI mention data.",
      noData: true,
    };
  }
  if (score < 30) {
    return {
      score,
      label: "Low",
      tone: "red",
      description: `You're mentioned in ${score}% of AI responses — competitors likely dominate.`,
      noData: false,
    };
  }
  if (score < 60) {
    return {
      score,
      label: "Medium",
      tone: "amber",
      description: `${score}% mention rate — solid foundation, room to grow.`,
      noData: false,
    };
  }
  return {
    score,
    label: "Strong",
    tone: "emerald",
    description: `${score}% mention rate — AI consistently surfaces your brand.`,
    noData: false,
  };
}

/**
 * Bucket a 0-100 retrievability score (Sprint 4 — cosine match of stored
 * chunks against a tracked prompt). Same buckets, different wording.
 */
export function bucketRetrievability(score: number, hasAnyChunks: boolean): BucketedScore {
  if (!hasAnyChunks) {
    return {
      score: 0,
      label: "No data yet",
      tone: "slate",
      description: "Analyze a page on the Audit Tool to measure retrievability.",
      noData: true,
    };
  }
  if (score < 30) {
    return {
      score,
      label: "Low",
      tone: "red",
      description: `Your top chunk matches ${score}% — AI is unlikely to retrieve your content.`,
      noData: false,
    };
  }
  if (score < 60) {
    return {
      score,
      label: "Medium",
      tone: "amber",
      description: `${score}% top match — present but not dominant in retrieval.`,
      noData: false,
    };
  }
  return {
    score,
    label: "Strong",
    tone: "emerald",
    description: `${score}% top match — your content is highly retrievable.`,
    noData: false,
  };
}

/**
 * Generic count bucketing (entities, citations, etc.). Returns the label
 * + tone without a percentage description.
 */
export function bucketCount(
  count: number,
  thresholds: { low: number; medium: number },
  noun: string,
): BucketedScore {
  if (count === 0) {
    return {
      score: 0,
      label: "No data yet",
      tone: "slate",
      description: `No ${noun} yet.`,
      noData: true,
    };
  }
  if (count < thresholds.low) {
    return {
      score: count,
      label: "Low",
      tone: "red",
      description: `${count} ${noun} — sparse.`,
      noData: false,
    };
  }
  if (count < thresholds.medium) {
    return {
      score: count,
      label: "Medium",
      tone: "amber",
      description: `${count} ${noun}.`,
      noData: false,
    };
  }
  return {
    score: count,
    label: "Strong",
    tone: "emerald",
    description: `${count} ${noun} — rich coverage.`,
    noData: false,
  };
}
