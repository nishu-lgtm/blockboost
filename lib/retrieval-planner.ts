/**
 * AI Retrieval Planner — Sprint 9.
 *
 * Combines signals from:
 *   - Sprint 1: visibility score (mention-parser / scan results)
 *   - Sprint 4: retrievability score (retrieval-engine)
 *   - Sprint 5: entity coverage (entity-extractor)
 *
 * Outputs up to 3 ranked next-best actions for a project.
 */

import { prisma } from "@/lib/prisma";

export interface RetrievalAction {
  priority: number; // 1 = highest
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: "visibility" | "retrieval" | "entities" | "delivery";
}

export interface PlannerResult {
  projectId: string;
  brandName: string;
  visibilityScore: number; // 0-100
  retrievabilityScore: number; // 0-100, max across stored chunks
  entityCount: number;
  actions: RetrievalAction[];
}

/**
 * Compute the top 3 ranked actions for a project.
 */
export async function computeNextActions(projectId: string): Promise<PlannerResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      mentions: {
        select: { brandMentioned: true },
      },
      retrievalChunks: {
        select: { id: true },
        take: 1,
      },
      entityNodes: {
        select: { id: true },
      },
      prompts: {
        select: { id: true },
      },
    },
  });

  if (!project) throw new Error(`Project ${projectId} not found`);

  const totalMentions = project.mentions.length;
  const citedMentions = project.mentions.filter((m) => m.brandMentioned).length;
  const visibilityScore =
    totalMentions > 0 ? Math.round((citedMentions / totalMentions) * 100) : 0;

  const hasChunks = project.retrievalChunks.length > 0;
  const entityCount = project.entityNodes.length;
  const hasPrompts = project.prompts.length > 0;

  // Retrievability score: use real Sprint 4 cosine match against the first
  // tracked prompt, NOT a made-up proxy from entity count. The previous proxy
  // showed "85" on the dashboard while the actual Audit tab showed "2" —
  // confusing users about whether retrievability was good or bad.
  let retrievabilityScore = 0;
  if (hasChunks && hasPrompts) {
    try {
      const { findRelevantChunks } = await import("@/lib/retrieval-engine");
      const firstPromptText = await prisma.prompt.findFirst({
        where: { projectId },
        select: { text: true },
        orderBy: { createdAt: "asc" },
      });
      if (firstPromptText) {
        const result = await findRelevantChunks(projectId, firstPromptText.text, 1);
        retrievabilityScore = result.retrievabilityScore;
      }
    } catch {
      // Embedding call may fail (no OPENAI_API_KEY in this env); leave score at 0
      retrievabilityScore = 0;
    }
  }

  const candidates: Array<RetrievalAction & { score: number }> = [];

  // ── Visibility actions ────────────────────────────────────────────────────

  if (totalMentions === 0) {
    candidates.push({
      priority: 0,
      score: 100,
      category: "visibility",
      impact: "high",
      title: "Run your first AI scan",
      description:
        "No queries have been scanned yet. Run a scan to see how AI assistants currently describe your brand.",
    });
  } else if (visibilityScore < 30) {
    candidates.push({
      priority: 0,
      score: 90,
      category: "visibility",
      impact: "high",
      title: "Boost brand mentions in AI responses",
      description: `Your visibility score is ${visibilityScore}%. Publish authoritative content that directly answers your tracked queries so AI systems cite you more.`,
    });
  } else if (visibilityScore < 60) {
    candidates.push({
      priority: 0,
      score: 60,
      category: "visibility",
      impact: "medium",
      title: "Expand tracked query coverage",
      description: `You're mentioned in ${visibilityScore}% of scans. Add more query variants to capture queries where competitors outrank you.`,
    });
  }

  // ── Retrieval actions ──────────────────────────────────────────────────────

  if (!hasChunks) {
    candidates.push({
      priority: 0,
      score: 85,
      category: "retrieval",
      impact: "high",
      title: "Analyze a page for AI retrievability",
      description:
        "No pages have been analyzed yet. Use the Audit Tool to see which sections of your site an AI would retrieve for your tracked queries.",
    });
  } else if (!hasPrompts) {
    candidates.push({
      priority: 0,
      score: 70,
      category: "retrieval",
      impact: "high",
      title: "Add prompts to enable retrieval scoring",
      description:
        "Pages are indexed but no tracked queries exist. Add queries in Settings so retrievability can be scored per page.",
    });
  }

  // ── Entity actions ─────────────────────────────────────────────────────────

  if (entityCount === 0) {
    candidates.push({
      priority: 0,
      score: 75,
      category: "entities",
      impact: "medium",
      title: "Extract your entity graph",
      description:
        "No entities have been extracted yet. Analyze a URL with entity extraction to help AI systems understand your brand's products, people, and relationships.",
    });
  } else if (entityCount < 5) {
    candidates.push({
      priority: 0,
      score: 50,
      category: "entities",
      impact: "medium",
      title: "Enrich your entity graph",
      description: `Only ${entityCount} entities found. Analyze more pages — product pages, About pages, and press releases tend to yield the richest entity data.`,
    });
  }

  // ── Delivery actions ───────────────────────────────────────────────────────

  candidates.push({
    priority: 0,
    score: entityCount > 0 ? 55 : 30,
    category: "delivery",
    impact: entityCount > 0 ? "medium" : "low",
    title: "Generate your AI delivery package",
    description:
      "Download your llm.md factsheet, facts.json, and entities.json to submit to AI indexes and embed in your site for direct AI consumption.",
  });

  // Sort by score desc, assign priority 1-3, return top 3
  const sorted = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c, i) => {
      const { score: _score, ...rest } = c;
      return { ...rest, priority: i + 1 };
    });

  return {
    projectId,
    brandName: project.brandName,
    visibilityScore,
    retrievabilityScore,
    entityCount,
    actions: sorted,
  };
}
