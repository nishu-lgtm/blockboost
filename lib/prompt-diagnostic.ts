/**
 * "Why am I losing this query?" diagnostic.
 *
 * Composes data the platform already collects into a single per-prompt
 * narrative: where you stand, what's in the AI answer, who's beating you,
 * what entities they have that you lack, what to do next.
 *
 * Why this exists: the dashboard previously made users hunt through eight
 * separate tabs (mentions, citations, entities, retrieval, gaps...) to
 * piece together why a specific prompt was losing. ChatGPT + user critique
 * 2026-05-16 both flagged the same gap: "the product should answer 'what
 * do I do today to win?' Right now eight separate dashboards make them
 * piece it together themselves."
 *
 * Pure composition — no new analysis or LLM calls. Existing Sprint 1-11
 * data is all we need.
 */
import { prisma } from "@/lib/prisma";
import type { Sentiment } from "@/lib/drift-detector";

export interface PerPlatformResult {
  platform: string;
  brandMentioned: boolean;
  competitorsMentioned: string[];
  sentiment: Sentiment;
  responseText: string;
  confidence: string | null;
  lastSeenAt: Date;
}

export interface DiagnosticAction {
  title: string;
  detail: string;
  href?: string;
  /** Visual priority for the UI: high → red border, medium → amber, low → slate. */
  impact: "high" | "medium" | "low";
}

export interface PromptDiagnostic {
  promptId: string;
  promptText: string;
  intent: string | null;
  /** How many times has this prompt been scanned across all platforms? */
  totalScans: number;
  /** Of those, how many resulted in brand-mention. */
  mentionCount: number;
  /** mentionCount / totalScans (0-100). */
  mentionRate: number;
  /** Verdict label for the headline: "Winning" / "Mixed" / "Losing" / "Untested". */
  verdict: "winning" | "mixed" | "losing" | "untested";
  /** Most recent scan result per platform. */
  perPlatform: PerPlatformResult[];
  /** Brand names that appeared on this prompt at least once. */
  competitorsSeen: string[];
  /** Entity names competitors have that this brand doesn't (from Sprint 5 graph). */
  missingEntities: string[];
  /** Sprint 4 retrieval score against this prompt, if chunks exist. */
  retrievabilityScore: number | null;
  /** Top retrieval chunks (Sprint 4) for context. */
  topChunks: Array<{ text: string; url: string; score: number }>;
  /** 1-3 actionable next steps composed from the signals above. */
  recommendedActions: DiagnosticAction[];
}

/**
 * Compute everything for one prompt × project. Single round-trip-ish to DB,
 * pure read.
 */
export async function diagnosePrompt(
  projectId: string,
  promptId: string,
): Promise<PromptDiagnostic | null> {
  // ── 1. Prompt + mentions + entity graph in parallel ─────────────────────
  const [prompt, mentions, entityNodes] = await Promise.all([
    prisma.prompt.findFirst({
      where: { id: promptId, projectId },
      select: { id: true, text: true, intent: true },
    }),
    prisma.mention.findMany({
      where: { projectId, promptId },
      orderBy: { createdAt: "desc" },
      select: {
        platform: true,
        brandMentioned: true,
        competitorsMentioned: true,
        sentiment: true,
        responseText: true,
        confidence: true,
        createdAt: true,
      },
    }),
    prisma.entityNode.findMany({
      where: { projectId },
      select: { type: true, name: true },
    }),
  ]);

  if (!prompt) return null;

  // ── 2. Aggregate scan stats ─────────────────────────────────────────────
  const totalScans = mentions.length;
  const mentionCount = mentions.filter((m) => m.brandMentioned).length;
  const mentionRate =
    totalScans > 0 ? Math.round((mentionCount / totalScans) * 100) : 0;

  const verdict: PromptDiagnostic["verdict"] =
    totalScans === 0
      ? "untested"
      : mentionRate >= 70
        ? "winning"
        : mentionRate >= 30
          ? "mixed"
          : "losing";

  // ── 3. Per-platform: take most recent per platform ─────────────────────
  const byPlatform = new Map<string, PerPlatformResult>();
  for (const m of mentions) {
    if (!byPlatform.has(m.platform)) {
      byPlatform.set(m.platform, {
        platform: m.platform,
        brandMentioned: m.brandMentioned,
        competitorsMentioned: m.competitorsMentioned,
        sentiment: m.sentiment as Sentiment,
        responseText: m.responseText,
        confidence: m.confidence,
        lastSeenAt: m.createdAt,
      });
    }
  }
  const perPlatform = Array.from(byPlatform.values());

  // ── 4. Competitor coverage on this prompt ───────────────────────────────
  const competitorsSeen = Array.from(
    new Set(mentions.flatMap((m) => m.competitorsMentioned)),
  ).sort();

  // ── 5. Missing entities: features/products that show up in any
  //      competitor response but NOT in any of our brand-mention responses.
  //      This is a simple heuristic, not a deep LLM analysis.
  const myFeatureEntities = entityNodes
    .filter((e) => ["feature", "product"].includes(e.type))
    .map((e) => e.name);

  // Look for entity names that appear in competitor-only response text
  const competitorOnlyResponses = mentions
    .filter((m) => !m.brandMentioned && m.competitorsMentioned.length > 0)
    .map((m) => m.responseText.toLowerCase());
  const missingEntities: string[] = [];
  for (const ent of myFeatureEntities) {
    const inCompetitor = competitorOnlyResponses.some((t) =>
      t.includes(ent.toLowerCase()),
    );
    if (inCompetitor) missingEntities.push(ent);
  }

  // ── 6. Retrieval score (Sprint 4) — only when chunks + OpenAI present ─
  let retrievabilityScore: number | null = null;
  let topChunks: PromptDiagnostic["topChunks"] = [];
  try {
    const chunkCount = await prisma.retrievalChunk.count({ where: { projectId } });
    if (chunkCount > 0) {
      const { findRelevantChunks } = await import("@/lib/retrieval-engine");
      const r = await findRelevantChunks(projectId, prompt.text, 3);
      retrievabilityScore = r.retrievabilityScore;
      // we need URL/text via DB since findRelevantChunks doesn't include url
      const chunkIds = r.topChunks.map((c) => c.chunkId);
      if (chunkIds.length > 0) {
        const chunks = await prisma.retrievalChunk.findMany({
          where: { id: { in: chunkIds } },
          select: { id: true, url: true, text: true },
        });
        const urlById = new Map(chunks.map((c) => [c.id, { url: c.url, text: c.text }]));
        topChunks = r.topChunks.map((c) => ({
          score: c.score,
          url: urlById.get(c.chunkId)?.url ?? "",
          text: urlById.get(c.chunkId)?.text ?? c.text,
        }));
      }
    }
  } catch {
    // OpenAI may be unavailable; leave retrieval fields null
  }

  // ── 7. Compose 1-3 recommended actions from the signals ──────────────────
  const recommendedActions: DiagnosticAction[] = [];

  if (verdict === "losing" && competitorsSeen.length > 0) {
    recommendedActions.push({
      title: `Write a comparison page targeting "${prompt.text}"`,
      detail:
        `${competitorsSeen.slice(0, 3).join(", ")} appear in AI answers for this query while you don't. ` +
        `A dedicated comparison page (with structured "vs" sections) is the most direct fix.`,
      href: "/dashboard/content-briefs",
      impact: "high",
    });
  }

  if (missingEntities.length > 0) {
    recommendedActions.push({
      title: `Cover topics competitors are known for: ${missingEntities.slice(0, 3).join(", ")}`,
      detail:
        `These topics appear in competitor responses for this query but aren't in your entity graph. ` +
        `Add content covering them so AI associates these capabilities with your brand.`,
      href: "/dashboard/entities",
      impact: "medium",
    });
  }

  if (retrievabilityScore !== null && retrievabilityScore < 40) {
    recommendedActions.push({
      title: "Improve retrievability of your target page",
      detail:
        `Your best chunk only matches this query at ${retrievabilityScore}% — AI is unlikely to surface it. ` +
        `Rewrite the page to directly answer the query, add FAQ-style headings, and host a llm.md.`,
      href: "/dashboard/audit",
      impact: "medium",
    });
  }

  if (recommendedActions.length === 0 && verdict !== "winning") {
    recommendedActions.push({
      title: "Run a deeper scan",
      detail:
        verdict === "untested"
          ? "This prompt hasn't been scanned yet. Trigger a scan to see how AI assistants describe your brand."
          : "Mixed results — try expanding consensus runs to higher cadence by upgrading to Growth+.",
      href: "/dashboard/ai-visibility",
      impact: "low",
    });
  }

  return {
    promptId: prompt.id,
    promptText: prompt.text,
    intent: prompt.intent,
    totalScans,
    mentionCount,
    mentionRate,
    verdict,
    perPlatform,
    competitorsSeen,
    missingEntities,
    retrievabilityScore,
    topChunks,
    recommendedActions,
  };
}
