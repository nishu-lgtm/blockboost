/**
 * Weekly Drift Detector — Sprint 11.
 *
 * Compares Mention data between two adjacent time windows ("current" and
 * "previous") and surfaces qualitative changes that decay alerts don't catch:
 *
 *   - newCitations: queries newly mentioning your brand
 *   - lostCitations: queries that stopped mentioning your brand
 *   - newCompetitors: competitors that just entered an AI answer
 *   - sentimentShifts: sentiment flipped direction on a query
 *
 * Pure analysis — `detectDrift` is a unit-testable function that takes raw
 * mention rows and returns a structured report. `analyzeProjectDrift` is the
 * DB-bound wrapper used by the API route.
 */

import { prisma } from "@/lib/prisma";

export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "NOT_MENTIONED";

export interface MentionLite {
  promptId: string;
  promptText: string;
  brandMentioned: boolean;
  competitorsMentioned: string[];
  sentiment: Sentiment;
  createdAt: Date;
}

export interface DriftItem {
  promptId: string;
  promptText: string;
  detail: string;
}

export interface SentimentShift extends DriftItem {
  from: Sentiment;
  to: Sentiment;
  direction: "improved" | "regressed";
}

export interface DriftReport {
  windowDays: number;
  newCitations: DriftItem[];
  lostCitations: DriftItem[];
  newCompetitors: DriftItem[];
  sentimentShifts: SentimentShift[];
  totalChanges: number;
}

const SENTIMENT_RANK: Record<Sentiment, number> = {
  NEGATIVE: 0,
  NOT_MENTIONED: 1,
  NEUTRAL: 2,
  POSITIVE: 3,
};

/**
 * Per-prompt aggregation: a prompt with any successful mention in the window
 * counts as "cited", and we keep its dominant sentiment + competitor set.
 */
interface PerPrompt {
  promptText: string;
  cited: boolean;
  competitors: Set<string>;
  sentiment: Sentiment;
}

function aggregate(mentions: MentionLite[]): Map<string, PerPrompt> {
  const map = new Map<string, PerPrompt>();
  for (const m of mentions) {
    const existing = map.get(m.promptId);
    if (existing) {
      if (m.brandMentioned) existing.cited = true;
      m.competitorsMentioned.forEach((c) => existing.competitors.add(c));
      // Prefer the strongest sentiment seen in the window
      if (SENTIMENT_RANK[m.sentiment] > SENTIMENT_RANK[existing.sentiment]) {
        existing.sentiment = m.sentiment;
      }
    } else {
      map.set(m.promptId, {
        promptText: m.promptText,
        cited: m.brandMentioned,
        competitors: new Set(m.competitorsMentioned),
        sentiment: m.sentiment,
      });
    }
  }
  return map;
}

/**
 * Pure drift detection — no DB calls. Easy to unit test.
 */
export function detectDrift(
  current: MentionLite[],
  previous: MentionLite[],
  windowDays: number
): DriftReport {
  const curr = aggregate(current);
  const prev = aggregate(previous);

  const newCitations: DriftItem[] = [];
  const lostCitations: DriftItem[] = [];
  const newCompetitors: DriftItem[] = [];
  const sentimentShifts: SentimentShift[] = [];

  // Iterate prompts that appear in either window
  const allPromptIds = new Set([...curr.keys(), ...prev.keys()]);

  for (const promptId of allPromptIds) {
    const c = curr.get(promptId);
    const p = prev.get(promptId);

    // Need data in BOTH windows to detect a real change (one-sided is noise)
    if (!c || !p) continue;

    const promptText = c.promptText || p.promptText;

    // New citation: you weren't cited last week, you are this week
    if (c.cited && !p.cited) {
      newCitations.push({
        promptId,
        promptText,
        detail: "First citation in this window",
      });
    }

    // Lost citation: you were cited last week, you aren't this week
    if (!c.cited && p.cited) {
      lostCitations.push({
        promptId,
        promptText,
        detail: "Was cited last week, not this week",
      });
    }

    // New competitor entrants
    const newcomers = [...c.competitors].filter((x) => !p.competitors.has(x));
    if (newcomers.length > 0) {
      newCompetitors.push({
        promptId,
        promptText,
        detail: `New: ${newcomers.slice(0, 3).join(", ")}`,
      });
    }

    // Sentiment shift — only when we were cited in both windows (otherwise
    // NOT_MENTIONED is the noise floor and already covered by lostCitations)
    if (c.cited && p.cited && c.sentiment !== p.sentiment) {
      const fromRank = SENTIMENT_RANK[p.sentiment];
      const toRank = SENTIMENT_RANK[c.sentiment];
      if (fromRank !== toRank) {
        sentimentShifts.push({
          promptId,
          promptText,
          from: p.sentiment,
          to: c.sentiment,
          direction: toRank > fromRank ? "improved" : "regressed",
          detail: `${p.sentiment.toLowerCase()} → ${c.sentiment.toLowerCase()}`,
        });
      }
    }
  }

  const totalChanges =
    newCitations.length +
    lostCitations.length +
    newCompetitors.length +
    sentimentShifts.length;

  return {
    windowDays,
    newCitations,
    lostCitations,
    newCompetitors,
    sentimentShifts,
    totalChanges,
  };
}

/**
 * DB-bound wrapper: loads two windows of mentions and runs detectDrift.
 */
export async function analyzeProjectDrift(
  projectId: string,
  windowDays = 7
): Promise<DriftReport> {
  const now = new Date();
  const currStart = new Date(now.getTime() - windowDays * 86400000);
  const prevStart = new Date(now.getTime() - windowDays * 2 * 86400000);

  const rows = await prisma.mention.findMany({
    where: {
      projectId,
      createdAt: { gte: prevStart, lt: now },
    },
    select: {
      promptId: true,
      brandMentioned: true,
      competitorsMentioned: true,
      sentiment: true,
      createdAt: true,
      prompt: { select: { text: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const current: MentionLite[] = [];
  const previous: MentionLite[] = [];

  for (const r of rows) {
    const lite: MentionLite = {
      promptId: r.promptId,
      promptText: r.prompt.text,
      brandMentioned: r.brandMentioned,
      competitorsMentioned: r.competitorsMentioned,
      sentiment: r.sentiment as Sentiment,
      createdAt: r.createdAt,
    };
    if (r.createdAt >= currStart) current.push(lite);
    else previous.push(lite);
  }

  return detectDrift(current, previous, windowDays);
}
