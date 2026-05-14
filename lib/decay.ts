/**
 * Visibility decay detector — pure compute, no I/O.
 *
 * Given a list of mentions with createdAt timestamps and brandMentioned flags,
 * computes the mention rate for two adjacent N-day windows and returns the
 * delta + a categorisation. The cron route persists Alerts based on the
 * verdict.
 *
 * Why this lives in a pure module:
 *   - Tested with synthetic data (no Prisma needed)
 *   - Cron route stays slim — just I/O + persistence
 *   - Rule 5: deterministic math doesn't belong in an LLM
 *
 * What decay means here:
 *   `currentRate − previousRate`. Negative = visibility dropped.
 *
 * Threshold (≤ -10pp) is the default but configurable per call so
 * different alert severities can use different cutoffs later.
 */

export interface DecayInput {
  mentions: Array<{
    createdAt: Date;
    brandMentioned: boolean;
    /** Sprint 2 confidence label — used to suppress noise. */
    confidence?: "high" | "medium" | "low" | null;
  }>;
  /** Length of each comparison window in days. Default 7. */
  windowDays?: number;
  /** Reference "now" — set in tests for determinism. Defaults to system now. */
  now?: Date;
}

export interface DecayResult {
  /** mention rate in the CURRENT window (last N days), 0–100 */
  currentRate: number;
  /** mention rate in the PREVIOUS window (N+1 to 2N days ago), 0–100 */
  previousRate: number;
  /** currentRate − previousRate in percentage points (negative = drop) */
  deltaPP: number;
  /** how many mentions backed the current rate (signal strength) */
  currentSampleSize: number;
  /** how many mentions backed the previous rate */
  previousSampleSize: number;
  /** True if both windows had at least this many mentions (default 5). */
  hasEnoughData: boolean;
  /**
   * "stable"   — change is within ±10pp
   * "decay"    — current dropped by 10pp or more
   * "growth"   — current grew by 10pp or more
   * "no-data"  — either window has too few mentions to trust
   */
  verdict: "stable" | "decay" | "growth" | "no-data";
}

const DEFAULT_THRESHOLD_PP = 10;
const DEFAULT_MIN_SAMPLES = 5;

export function computeDecay(input: DecayInput): DecayResult {
  const windowDays = input.windowDays ?? 7;
  const now = input.now ?? new Date();

  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = new Date(now.getTime() - windowDays * dayMs);
  const previousStart = new Date(now.getTime() - 2 * windowDays * dayMs);

  let cMentioned = 0;
  let cTotal = 0;
  let pMentioned = 0;
  let pTotal = 0;

  for (const m of input.mentions) {
    const t = m.createdAt.getTime();
    // Skip low-confidence mentions entirely — they're the same single-pass
    // noise the rest of the product warns about. Including them here would
    // generate decay alerts on shaky data.
    if (m.confidence === "low") continue;

    if (t >= currentStart.getTime() && t <= now.getTime()) {
      cTotal++;
      if (m.brandMentioned) cMentioned++;
    } else if (t >= previousStart.getTime() && t < currentStart.getTime()) {
      pTotal++;
      if (m.brandMentioned) pMentioned++;
    }
  }

  const currentRate = cTotal > 0 ? Math.round((cMentioned / cTotal) * 100) : 0;
  const previousRate = pTotal > 0 ? Math.round((pMentioned / pTotal) * 100) : 0;
  const deltaPP = currentRate - previousRate;

  const hasEnoughData = cTotal >= DEFAULT_MIN_SAMPLES && pTotal >= DEFAULT_MIN_SAMPLES;
  let verdict: DecayResult["verdict"];
  if (!hasEnoughData) {
    verdict = "no-data";
  } else if (deltaPP <= -DEFAULT_THRESHOLD_PP) {
    verdict = "decay";
  } else if (deltaPP >= DEFAULT_THRESHOLD_PP) {
    verdict = "growth";
  } else {
    verdict = "stable";
  }

  return {
    currentRate,
    previousRate,
    deltaPP,
    currentSampleSize: cTotal,
    previousSampleSize: pTotal,
    hasEnoughData,
    verdict,
  };
}

/**
 * Build the human-readable message that goes on the Alert row.
 * Kept here (not in the cron route) so it stays test-anchored.
 */
export function decayAlertMessage(result: DecayResult, brandName: string): string {
  const drop = Math.abs(result.deltaPP);
  return (
    `${brandName} visibility dropped ${drop}pp in the last week ` +
    `(${result.previousRate}% → ${result.currentRate}%, ${result.currentSampleSize} mentions).`
  );
}
