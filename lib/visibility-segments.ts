/**
 * Branded vs Unbranded Visibility Segmentation.
 *
 * A 35% "overall mention rate" is misleading when 100% of it comes from
 * prompts that contain the brand name. ChatGPT engaging with
 * "what is the pricing for PlutoxAI" is not the same signal as ChatGPT
 * recommending PlutoxAI for "best AI content tools in 2026". The first
 * has zero discovery value — the customer already knew the brand. The
 * second is where real AI-driven discovery happens.
 *
 * This module slices visibility into the two segments and computes a
 * weighted score that anchors on unbranded discovery (the harder, more
 * meaningful signal) while still surfacing branded recall as context.
 *
 * Why this exists: user feedback 2026-05-16 ("does current update match
 * this output [ChatGPT audit saying LOW visibility]?"). With unsegmented
 * 35% the dashboard reads as "Medium". With segmentation the unbranded
 * 0% reads as "Critical" — which matches every external audit and is
 * the actual truth about PlutoxAI's AI discoverability today.
 */
import { prisma } from "@/lib/prisma";

export interface VisibilitySegment {
  /** How many distinct prompts are in this segment. */
  promptCount: number;
  /** Total mention rows across those prompts (= prompts × runs × platforms). */
  totalScans: number;
  /** How many of those scans cited the brand. */
  citedScans: number;
  /** citedScans / totalScans (0-100). */
  mentionRate: number;
}

export interface VisibilitySegments {
  branded: VisibilitySegment;
  unbranded: VisibilitySegment;
  /** Overall un-weighted mention rate across all scans (the legacy number). */
  overallMentionRate: number;
  /**
   * Weighted score that anchors on unbranded.
   *
   *   weighted = 0.7 × unbrandedRate + 0.3 × brandedRate
   *
   * Rationale: branded recall has some value (the user clicked through
   * after seeing your brand name), but unbranded discovery is what AI
   * Visibility actually means. 70/30 keeps branded relevant without
   * letting it dominate. If there are no unbranded prompts at all the
   * weighted score falls back to the branded rate so brand-new projects
   * with only branded queries aren't unfairly penalised.
   */
  weightedScore: number;
}

/**
 * Returns true when the prompt text contains the brand name (or a
 * normalised variant — same rules as mention-parser's normaliseBrand).
 */
export function isPromptBranded(promptText: string, brandName: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-._]/g, "");
  return norm(promptText).includes(norm(brandName));
}

/**
 * Compute the branded/unbranded mention rates for a project.
 *
 * Pure read — single round trip to DB. Safe to call on every dashboard
 * page-load; reuses the same data that powers /api/visibility.
 */
export async function computeVisibilitySegments(
  projectId: string,
): Promise<VisibilitySegments> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      brandName: true,
      prompts: {
        select: {
          id: true,
          text: true,
          _count: { select: { mentions: true } },
        },
      },
    },
  });
  if (!project) {
    const empty: VisibilitySegment = { promptCount: 0, totalScans: 0, citedScans: 0, mentionRate: 0 };
    return { branded: empty, unbranded: empty, overallMentionRate: 0, weightedScore: 0 };
  }

  // Partition prompts by branded-ness
  const brandedPromptIds: string[] = [];
  const unbrandedPromptIds: string[] = [];
  for (const p of project.prompts) {
    if (isPromptBranded(p.text, project.brandName)) brandedPromptIds.push(p.id);
    else unbrandedPromptIds.push(p.id);
  }

  // Tally mentions for each segment in parallel
  const [brandedTotal, brandedCited, unbrandedTotal, unbrandedCited] = await Promise.all([
    prisma.mention.count({ where: { projectId, promptId: { in: brandedPromptIds } } }),
    prisma.mention.count({ where: { projectId, promptId: { in: brandedPromptIds }, brandMentioned: true } }),
    prisma.mention.count({ where: { projectId, promptId: { in: unbrandedPromptIds } } }),
    prisma.mention.count({ where: { projectId, promptId: { in: unbrandedPromptIds }, brandMentioned: true } }),
  ]);

  const branded: VisibilitySegment = {
    promptCount: brandedPromptIds.length,
    totalScans: brandedTotal,
    citedScans: brandedCited,
    mentionRate: brandedTotal > 0 ? Math.round((brandedCited / brandedTotal) * 100) : 0,
  };
  const unbranded: VisibilitySegment = {
    promptCount: unbrandedPromptIds.length,
    totalScans: unbrandedTotal,
    citedScans: unbrandedCited,
    mentionRate: unbrandedTotal > 0 ? Math.round((unbrandedCited / unbrandedTotal) * 100) : 0,
  };

  const totalScans = brandedTotal + unbrandedTotal;
  const overallMentionRate =
    totalScans > 0 ? Math.round(((brandedCited + unbrandedCited) / totalScans) * 100) : 0;

  // Weighted: 70% unbranded + 30% branded. If no unbranded prompts exist
  // (e.g. brand-new project that only has branded queries), fall back to
  // the branded rate so we don't punish them unfairly.
  let weightedScore: number;
  if (unbrandedTotal === 0) weightedScore = branded.mentionRate;
  else if (brandedTotal === 0) weightedScore = unbranded.mentionRate;
  else weightedScore = Math.round(0.7 * unbranded.mentionRate + 0.3 * branded.mentionRate);

  return { branded, unbranded, overallMentionRate, weightedScore };
}
