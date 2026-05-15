/**
 * Entity Graph Extractor — Sprint 5.
 *
 * Given plain text (from chunker), uses GPT-mini to extract named entities
 * (brand, product, person, feature, location, organization) and relations
 * between them. Stores results in EntityNode + EntityEdge tables.
 *
 * Idempotent: @@unique on (projectId, type, name) and (projectId, from, to, relation)
 * means re-running on the same content only adds new entities/edges.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { llmCall } from "@/lib/llm-call";
import { logSafeError } from "@/lib/safe-error";

// ── Zod schema for LLM output ────────────────────────────────────────────────

const entitySchema = z.object({
  entities: z.array(
    z.object({
      type: z.enum(["brand", "product", "person", "feature", "location", "organization"]),
      name: z.string().min(1).max(200),
    })
  ),
  relations: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      relation: z.enum(["sells", "founded_by", "located_in", "competes_with", "part_of", "uses"]),
    })
  ),
});

type EntityGraph = z.infer<typeof entitySchema>;

const EMPTY_GRAPH: EntityGraph = { entities: [], relations: [] };

// ── LLM extraction ───────────────────────────────────────────────────────────

async function extractFromText(text: string, brandName: string): Promise<EntityGraph> {
  const result = await llmCall({
    feature: "entity-extractor",
    model: "fast",
    schema: entitySchema,
    fallback: EMPTY_GRAPH,
    sanitiseLastUserMessage: true,
    temperature: 0,
    maxTokens: 800,
    messages: [
      {
        role: "system",
        content: `You extract structured entities and relations from web content for a brand intelligence platform.

Extract ONLY entities actually mentioned in the text. Types:
- brand: the company/product brand (e.g. "${brandName}")
- product: specific products or services
- person: founders, executives, public figures
- feature: product features or capabilities
- location: cities, countries, regions
- organization: other companies, institutions, partners

Relations: sells, founded_by, located_in, competes_with, part_of, uses

Return JSON: { "entities": [{"type":"...","name":"..."}], "relations": [{"from":"...","to":"...","relation":"..."}] }
Relations must reference entity names from the entities array. Return empty arrays if nothing found.`,
      },
      {
        role: "user",
        content: `Brand context: ${brandName}\n\nContent:\n${text.slice(0, 3000)}`,
      },
    ],
  });

  return result.data;
}

// ── DB persistence ────────────────────────────────────────────────────────────

export interface ExtractionSummary {
  nodesCreated: number;
  edgesCreated: number;
}

/**
 * Extract entities from `text` and upsert into the entity graph for `projectId`.
 */
export async function extractAndStoreEntities(
  projectId: string,
  brandName: string,
  text: string
): Promise<ExtractionSummary> {
  let graph: EntityGraph;
  try {
    graph = await extractFromText(text, brandName);
  } catch (err) {
    logSafeError("[entity-extractor] extraction failed", err);
    return { nodesCreated: 0, edgesCreated: 0 };
  }

  if (graph.entities.length === 0) return { nodesCreated: 0, edgesCreated: 0 };

  // Upsert nodes
  let nodesCreated = 0;
  const nodeMap = new Map<string, string>(); // name → id

  for (const entity of graph.entities) {
    try {
      const node = await prisma.entityNode.upsert({
        where: { projectId_type_name: { projectId, type: entity.type, name: entity.name } },
        create: { projectId, type: entity.type, name: entity.name },
        update: {}, // already exists — keep it
      });
      nodeMap.set(entity.name, node.id);
      nodesCreated++;
    } catch (err) {
      logSafeError(`[entity-extractor] node upsert failed: ${entity.name}`, err);
    }
  }

  // Upsert edges (only between nodes we successfully created)
  let edgesCreated = 0;
  for (const rel of graph.relations) {
    const fromId = nodeMap.get(rel.from);
    const toId = nodeMap.get(rel.to);
    if (!fromId || !toId || fromId === toId) continue;

    try {
      await prisma.entityEdge.upsert({
        where: { projectId_fromId_toId_relation: { projectId, fromId, toId, relation: rel.relation } },
        create: { projectId, fromId, toId, relation: rel.relation },
        update: {},
      });
      edgesCreated++;
    } catch (err) {
      logSafeError(`[entity-extractor] edge upsert failed`, err);
    }
  }

  return { nodesCreated, edgesCreated };
}

/**
 * Load the full entity graph for a project.
 */
export async function getEntityGraph(projectId: string) {
  const [nodes, edges] = await Promise.all([
    prisma.entityNode.findMany({
      where: { projectId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.entityEdge.findMany({
      where: { projectId },
      include: { from: true, to: true },
    }),
  ]);
  return { nodes, edges };
}
