/**
 * Score Breakdown — answers "WHY is my AI Visibility score what it is?"
 *
 * User feedback 2026-05-16: the Overview showed "Low 15/100" without
 * explaining the components. They asked for a breakdown that names each
 * driver, scores it 0-10, and labels the impact (high/medium/low/critical).
 *
 * Pure composition — every driver is read from existing tables. No new
 * analysis, no fake "Revenue Impact Estimator" (user explicitly excluded).
 * If a driver lacks data (e.g. no retrieval chunks yet), it shows "No data"
 * rather than a placeholder — honesty > fake-precision.
 */
import { prisma } from "@/lib/prisma";
import { computeVisibilitySegments } from "@/lib/visibility-segments";

export type DriverImpact = "critical" | "high" | "medium" | "low";

export interface ScoreDriver {
  /** Short, marketer-friendly label. */
  label: string;
  /** Plain-English one-liner explaining WHY this matters. */
  why: string;
  /** Current value as a 0-10 score (10 = strong). */
  score: number;
  /** Whether we have enough data to score this driver. */
  hasData: boolean;
  /** How much this driver weighs in the headline visibility number. */
  impact: DriverImpact;
  /** What this driver shows (e.g. "0/6 generic queries"). */
  detail: string;
}

export interface ScoreBreakdown {
  /** The 5 drivers, ordered by impact desc then score asc (worst first). */
  drivers: ScoreDriver[];
  /** Cumulative impact: "Critical" / "High" / "Medium" / "Low" — top of the list. */
  worstDriver: ScoreDriver | null;
}

const IMPACT_RANK: Record<DriverImpact, number> = { critical: 3, high: 2, medium: 1, low: 0 };

/**
 * Convert a 0-100 percentage into a 0-10 driver score.
 */
function pctTo10(pct: number): number {
  return Math.round(pct / 10);
}

function chooseImpact(score: number, isStructural: boolean): DriverImpact {
  // Structural drivers (entity graph, retrieval) are critical when empty
  // because they're prerequisites for everything else working.
  if (score === 0 && isStructural) return "critical";
  if (score <= 2) return isStructural ? "critical" : "high";
  if (score <= 5) return "medium";
  return "low";
}

export async function computeScoreBreakdown(projectId: string): Promise<ScoreBreakdown> {
  const [segments, entityCount, retrievalChunkCount, citationCount, mentionCount] =
    await Promise.all([
      computeVisibilitySegments(projectId),
      prisma.entityNode.count({ where: { projectId } }),
      prisma.retrievalChunk.count({ where: { projectId } }),
      prisma.citation.count({ where: { projectId, isOwned: true } }),
      prisma.mention.count({ where: { projectId } }),
    ]);

  // ── Driver 1: Unbranded discovery ────────────────────────────────────
  // The most important driver — does AI surface your brand for generic
  // queries? Weighted heaviest in the headline score.
  const unbrandedHasData = segments.unbranded.totalScans > 0;
  const unbrandedScore = pctTo10(segments.unbranded.mentionRate);
  const unbrandedDriver: ScoreDriver = {
    label: "Unbranded discovery",
    why: "How often AI surfaces your brand on generic, non-branded queries — the real measure of AI-driven discovery.",
    score: unbrandedScore,
    hasData: unbrandedHasData,
    impact: chooseImpact(unbrandedScore, true),
    detail: !unbrandedHasData
      ? "No unbranded prompts tracked yet."
      : `${segments.unbranded.citedScans}/${segments.unbranded.totalScans} generic-query scans cited your brand.`,
  };

  // ── Driver 2: Branded recall ─────────────────────────────────────────
  // Lower weight — engagement with branded prompts is partly hedged
  // ("If you mean PlutoxAI…") but still indicates the AI engages with
  // the brand name.
  const brandedHasData = segments.branded.totalScans > 0;
  const brandedScore = pctTo10(segments.branded.mentionRate);
  const brandedDriver: ScoreDriver = {
    label: "Branded recall",
    why: "When customers name your brand in their question, does AI engage substantively — or hedge and disclaim?",
    score: brandedScore,
    hasData: brandedHasData,
    impact: chooseImpact(brandedScore, false),
    detail: !brandedHasData
      ? "No branded prompts tracked yet."
      : `${segments.branded.citedScans}/${segments.branded.totalScans} branded scans cited your brand.`,
  };

  // ── Driver 3: Citation presence ──────────────────────────────────────
  // How often did AI cite a URL owned by this brand in scan responses?
  const citationHasData = mentionCount > 0;
  // 1 cite per ~3 mentions is "good"; 10+ is strong.
  const citationScore = !citationHasData
    ? 0
    : Math.min(10, Math.round((citationCount / Math.max(1, mentionCount)) * 30));
  const citationDriver: ScoreDriver = {
    label: "Owned-URL citations",
    why: "How often AI linked to YOUR pages (not third-party sources) — direct AI traffic potential.",
    score: citationScore,
    hasData: citationHasData,
    impact: chooseImpact(citationScore, false),
    detail: !citationHasData
      ? "No scans yet."
      : `${citationCount} owned URL${citationCount === 1 ? "" : "s"} cited across ${mentionCount} scan${mentionCount === 1 ? "" : "s"}.`,
  };

  // ── Driver 4: Brand knowledge depth (entity graph) ───────────────────
  const entityHasData = entityCount > 0;
  // 0 nodes = critical gap; 5-9 = okay; 10+ = strong
  const entityScore = entityCount === 0 ? 0 : Math.min(10, Math.round(entityCount));
  const entityDriver: ScoreDriver = {
    label: "Brand knowledge depth",
    why: "What AI knows about your products, people, features, and relationships — the foundation it uses to recommend you.",
    score: entityScore,
    hasData: entityHasData,
    impact: chooseImpact(entityScore, true),
    detail: entityCount === 0
      ? "No entities extracted yet — AI sees your brand as a black box."
      : `${entityCount} entit${entityCount === 1 ? "y" : "ies"} mapped in your brand graph.`,
  };

  // ── Driver 5: Retrieval readiness ────────────────────────────────────
  const retrievalHasData = retrievalChunkCount > 0;
  // Score based on whether content has been indexed at all. Real retrieval
  // quality is computed per-query — this just measures coverage breadth.
  const retrievalScore = !retrievalHasData
    ? 0
    : Math.min(10, Math.round(retrievalChunkCount / 3));
  const retrievalDriver: ScoreDriver = {
    label: "Retrieval readiness",
    why: "How much of your content is indexed in shapes AI systems retrieve — pages that aren't indexed can't be cited.",
    score: retrievalScore,
    hasData: retrievalHasData,
    impact: chooseImpact(retrievalScore, true),
    detail: retrievalChunkCount === 0
      ? "No pages analyzed yet — run an audit to start measuring retrievability."
      : `${retrievalChunkCount} content chunks indexed for retrieval.`,
  };

  const drivers = [
    unbrandedDriver,
    brandedDriver,
    citationDriver,
    entityDriver,
    retrievalDriver,
  ].sort((a, b) => {
    // Worst-first: highest impact, then lowest score
    const impactDiff = IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact];
    if (impactDiff !== 0) return impactDiff;
    return a.score - b.score;
  });

  return {
    drivers,
    worstDriver: drivers.find((d) => d.hasData && d.score <= 5) ?? drivers[0],
  };
}
