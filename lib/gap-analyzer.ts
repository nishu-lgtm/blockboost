/**
 * Content Gap Intelligence — Sprint 10.
 *
 * Enriches the basic "you lost this query" gap rows with three signals:
 *
 *   gapScore        0-100 urgency score (competitor count × consensus rate)
 *   missingEntities entity names that appear in competitor response texts
 *                   but are absent from your own successful responses
 *   contentHint     rule-based one-line content recommendation
 *
 * No LLM required — all signals derived from data already in the DB.
 */

import { prisma } from "@/lib/prisma";

export interface EnrichedGapRow {
  promptId: string;
  promptText: string;
  intent: string | null;
  competitorsPresent: string[];
  gapScore: number;
  missingEntities: string[];
  contentHint: string;
}

export async function analyzeGaps(projectId: string): Promise<EnrichedGapRow[]> {
  // Load prompts that have at least one "loss" mention (competitor in, brand out)
  const gapMentions = await prisma.mention.findMany({
    where: {
      projectId,
      brandMentioned: false,
      NOT: { competitorsMentioned: { isEmpty: true } },
    },
    select: {
      promptId: true,
      competitorsMentioned: true,
      consensusRate: true,
      responseText: true,
      prompt: { select: { text: true, intent: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200, // cap for perf
  });

  if (gapMentions.length === 0) return [];

  // Load your own successful mentions to know which entities you already cover
  const winMentions = await prisma.mention.findMany({
    where: { projectId, brandMentioned: true },
    select: { promptId: true, responseText: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Load entity names for this project
  const entityNodes = await prisma.entityNode.findMany({
    where: { projectId },
    select: { name: true },
  });
  const entityNames = entityNodes.map((n) => n.name.toLowerCase());

  // Build per-prompt win coverage: set of entity names present in your own winning responses
  const winCoverageByPrompt = new Map<string, Set<string>>();
  for (const m of winMentions) {
    const lower = m.responseText.toLowerCase();
    const covered = entityNames.filter((e) => lower.includes(e));
    const existing = winCoverageByPrompt.get(m.promptId) ?? new Set<string>();
    covered.forEach((e) => existing.add(e));
    winCoverageByPrompt.set(m.promptId, existing);
  }

  // Aggregate per prompt
  type PromptAgg = {
    promptText: string;
    intent: string | null;
    competitors: Set<string>;
    totalConsensus: number;
    consensusCount: number;
    competitorText: string; // concatenated competitor response texts
  };

  const byPrompt = new Map<string, PromptAgg>();

  for (const m of gapMentions) {
    const existing = byPrompt.get(m.promptId);
    const competitors = m.competitorsMentioned;
    if (existing) {
      competitors.forEach((c) => existing.competitors.add(c));
      if (m.consensusRate != null) {
        existing.totalConsensus += m.consensusRate;
        existing.consensusCount++;
      }
      existing.competitorText += " " + m.responseText;
    } else {
      const agg: PromptAgg = {
        promptText: m.prompt.text,
        intent: m.prompt.intent,
        competitors: new Set(competitors),
        totalConsensus: m.consensusRate ?? 0,
        consensusCount: m.consensusRate != null ? 1 : 0,
        competitorText: m.responseText,
      };
      byPrompt.set(m.promptId, agg);
    }
  }

  const rows: EnrichedGapRow[] = [];

  for (const [promptId, agg] of byPrompt.entries()) {
    const competitorCount = agg.competitors.size;
    const avgConsensus =
      agg.consensusCount > 0 ? agg.totalConsensus / agg.consensusCount : 0.5;

    // gapScore: 0-100 — more competitors + higher consensus = more urgent
    const gapScore = Math.min(100, Math.round(competitorCount * 25 + avgConsensus * 50));

    // Missing entities: appear in competitor responses, absent from your wins
    const competitorLower = agg.competitorText.toLowerCase();
    const winCoverage = winCoverageByPrompt.get(promptId) ?? new Set<string>();
    const missingEntities = entityNames
      .filter((e) => competitorLower.includes(e) && !winCoverage.has(e))
      .map((e) => entityNodes.find((n) => n.name.toLowerCase() === e)?.name ?? e)
      .slice(0, 4); // cap at 4 badges

    // Content hint — rule-based, no LLM
    const contentHint = buildContentHint(
      agg.promptText,
      agg.intent,
      Array.from(agg.competitors),
      missingEntities
    );

    rows.push({
      promptId,
      promptText: agg.promptText,
      intent: agg.intent,
      competitorsPresent: Array.from(agg.competitors),
      gapScore,
      missingEntities,
      contentHint,
    });
  }

  return rows.sort((a, b) => b.gapScore - a.gapScore);
}

function buildContentHint(
  promptText: string,
  intent: string | null,
  competitors: string[],
  missingEntities: string[]
): string {
  const topCompetitor = competitors[0] ?? "competitors";
  const topEntity = missingEntities[0];

  const lower = promptText.toLowerCase();

  if (intent === "comparison" || lower.includes(" vs ") || lower.includes(" versus ") || lower.includes("compare")) {
    return topEntity
      ? `Publish a comparison page covering "${topEntity}" to appear alongside ${topCompetitor}.`
      : `Create a direct comparison page — AI answers favour brands that explicitly address comparison queries.`;
  }

  if (intent === "recommendation" || lower.includes("best") || lower.includes("top ") || lower.includes("recommend")) {
    return topEntity
      ? `Add a "best for ${topEntity}" section to rank beside ${topCompetitor} on recommendation queries.`
      : `Publish a recommendation guide that directly names your product as the answer to this query.`;
  }

  if (intent === "how_to" || lower.startsWith("how ") || lower.startsWith("how to")) {
    return topEntity
      ? `Write a how-to guide that mentions "${topEntity}" — ${topCompetitor} is being cited because their content answers this step-by-step.`
      : `Create step-by-step content that directly answers this query; AI systems prefer instructional formats.`;
  }

  if (missingEntities.length > 0) {
    return `Add content about "${missingEntities.slice(0, 2).join('" and "')}" — these topics appear in AI answers that cite ${topCompetitor} but not you.`;
  }

  return `Create a dedicated page that directly answers this query; ${topCompetitor} is currently the AI's preferred source.`;
}
