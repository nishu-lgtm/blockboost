/**
 * AI Delivery Infrastructure — Sprint 6.
 *
 * Generates three machine-readable files that AI systems can consume to
 * accurately represent a brand:
 *   llm.md       — markdown factsheet for language models
 *   facts.json   — structured key-value brand facts
 *   entities.json — entity graph (nodes + edges) from Sprint 5
 */

import { prisma } from "@/lib/prisma";

export interface DeliveryBundle {
  llmMd: string;
  factsJson: string;
  entitiesJson: string;
}

/**
 * Build the three delivery artifacts for a project.
 * Pulls brand facts from Project and the entity graph from EntityNode/EntityEdge.
 */
export async function buildDeliveryBundle(projectId: string): Promise<DeliveryBundle> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      entityNodes: { orderBy: [{ type: "asc" }, { name: "asc" }] },
      entityEdges: { include: { from: true, to: true } },
      prompts: { select: { text: true }, take: 10 },
    },
  });

  if (!project) throw new Error(`Project ${projectId} not found`);

  const { brandName, websiteUrl, entityNodes, entityEdges, prompts } = project;

  // ── llm.md ───────────────────────────────────────────────────────────────

  const nodesByType = groupBy(entityNodes, (n: { type: string }) => n.type);

  const sections: string[] = [
    `# ${brandName} — AI Factsheet`,
    ``,
    `> Auto-generated for AI consumption. Do not edit manually.`,
    ``,
    `## About`,
    `- **Brand**: ${brandName}`,
    websiteUrl ? `- **Website**: ${websiteUrl}` : null,
    ``,
  ].filter((l): l is string => l !== null);

  for (const [type, nodes] of Object.entries(nodesByType)) {
    if (nodes.length === 0) continue;
    const heading = type.charAt(0).toUpperCase() + type.slice(1) + "s";
    sections.push(`## ${heading}`);
    sections.push(...nodes.map((n) => `- ${n.name}`));
    sections.push(``);
  }

  if (entityEdges.length > 0) {
    sections.push(`## Relationships`);
    sections.push(
      ...entityEdges.map((e) => `- ${e.from.name} **${e.relation}** ${e.to.name}`)
    );
    sections.push(``);
  }

  if (prompts.length > 0) {
    sections.push(`## Tracked Queries`);
    sections.push(...prompts.map((p) => `- ${p.text}`));
    sections.push(``);
  }

  const llmMd = sections.join("\n");

  // ── facts.json ───────────────────────────────────────────────────────────

  const facts: Record<string, unknown> = {
    brand: brandName,
    website: websiteUrl ?? null,
    generatedAt: new Date().toISOString(),
    entities: Object.fromEntries(
      Object.entries(nodesByType).map(([type, nodes]) => [type, nodes.map((n) => n.name)])
    ),
  };

  const factsJson = JSON.stringify(facts, null, 2);

  // ── entities.json ─────────────────────────────────────────────────────────

  const entitiesPayload = {
    nodes: entityNodes.map((n) => ({ id: n.id, type: n.type, name: n.name })),
    edges: entityEdges.map((e) => ({
      from: e.from.name,
      to: e.to.name,
      relation: e.relation,
    })),
  };

  const entitiesJson = JSON.stringify(entitiesPayload, null, 2);

  return { llmMd, factsJson, entitiesJson };
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}
