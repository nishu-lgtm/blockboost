/**
 * AI crawler User-Agent classifier — pure, no I/O.
 *
 * Used by /api/track/visit to determine if an incoming visit is from an AI
 * crawler we care about. Decisions:
 *
 *   - Known AI bot (matched UA) → return botName ("GPTBot", "ClaudeBot", etc).
 *     Ingested into AiBotVisit.
 *   - AI-ish (e.g. unknown OpenAI / Anthropic agent) → return "OTHER".
 *     Still ingested for analysis, with botName="OTHER".
 *   - Human (any normal browser UA) → return null.  Caller drops the row.
 *
 * Rule 5: this is pure pattern-matching. The LLM has no place here.
 *
 * Rule 9 anchor: see lib/bot-detector.test.ts — 7 known-bots × 3 humans.
 */

import crypto from "crypto";

export type BotLabel =
  | "GPTBot"
  | "OAI-SearchBot"
  | "ChatGPT-User"
  | "ClaudeBot"
  | "PerplexityBot"
  | "Bytespider"
  | "CCBot"
  | "Google-Extended"
  | "OTHER";

interface Rule {
  label: BotLabel;
  pattern: RegExp;
}

// Order matters: most specific UA fragments first. The first match wins.
const KNOWN_BOTS: Rule[] = [
  { label: "GPTBot", pattern: /\bGPTBot\b/i },
  { label: "OAI-SearchBot", pattern: /\bOAI-SearchBot\b/i },
  { label: "ChatGPT-User", pattern: /\bChatGPT-User\b/i },
  { label: "ClaudeBot", pattern: /\bClaude(?:Bot|-Web|-User)\b/i },
  { label: "PerplexityBot", pattern: /\bPerplexity(?:Bot|-User)\b/i },
  { label: "Bytespider", pattern: /\bBytespider\b/i },
  { label: "CCBot", pattern: /\bCCBot\b/i },
  { label: "Google-Extended", pattern: /\bGoogle-Extended\b/i },
];

// Heuristics for "AI-ish but unknown" → tagged as OTHER (still ingested).
const AI_ISH = /\b(openai|anthropic|cohere|meta-llama|llamaindex)\b/i;

// Heuristics for clearly-human traffic → null (caller drops).
const HUMAN_INDICATORS = /\b(Mozilla|Chrome|Safari|Firefox|Edge|Opera|Mobile)\b/i;

export function classifyUserAgent(ua: string | null | undefined): BotLabel | null {
  if (typeof ua !== "string" || ua.length === 0) return null;

  // 1. Known bot match (most specific first)
  for (const { label, pattern } of KNOWN_BOTS) {
    if (pattern.test(ua)) return label;
  }

  // 2. AI-ish unknown agent → OTHER (worth tracking; emerging signal)
  if (AI_ISH.test(ua)) return "OTHER";

  // 3. Looks human → drop
  if (HUMAN_INDICATORS.test(ua)) return null;

  // 4. Truly unknown UA → drop (don't pollute analytics with random scrapers)
  return null;
}

/**
 * Stable de-dupe key. SHA-256 of "projectId|botName|url|YYYY-MM-DD".
 * Used by the @@unique constraint on AiBotVisit so cron retries +
 * reload spam can't double-count.
 *
 * Day boundary is UTC midnight — same UTC day = duplicate. Consistent
 * with the cron job timezone (Vercel cron runs in UTC).
 */
export function buildDedupeKey(input: {
  projectId: string;
  botName: BotLabel;
  url: string;
  at?: Date;
}): string {
  const day = (input.at ?? new Date()).toISOString().slice(0, 10); // YYYY-MM-DD
  const raw = `${input.projectId}|${input.botName}|${input.url}|${day}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Best-effort IP hash for analytics. Never store raw IPs — privacy
 * principle + GDPR. Hash with a server-side salt so the same IP across
 * different projects still produces different hashes (no cross-project
 * tracking).
 */
export function hashIp(ip: string | null | undefined, salt: string): string | null {
  if (!ip || ip.length === 0) return null;
  return crypto.createHash("sha256").update(`${salt}|${ip}`).digest("hex").slice(0, 16);
}
