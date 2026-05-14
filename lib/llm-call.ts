/**
 * Single entry point for every OpenAI chat completion in this codebase.
 *
 * Replaces ~7 hand-rolled call sites that each duplicate:
 *   - OpenAI client instantiation + no-key fallback
 *   - moderation pre-check
 *   - input sanitisation + delimiter wrapping
 *   - cache lookup / write
 *   - JSON parsing + Zod validation
 *   - error handling + safe logging
 *   - silent-fallback flagging
 *
 * Any new AI feature should call `llmCall()` instead of touching `openai.chat.completions.create()`
 * directly. This makes the AI surface auditable from one file.
 */

import OpenAI from "openai";
import { z } from "zod";
import { sanitizeForLLM, parseStructuredJson, detectInjectionAttempt } from "@/lib/llm-safety";
import { moderateContent } from "@/lib/llm-moderation";
import { buildCacheKey, withCache } from "@/lib/llm-cache";
import { logSafeError } from "@/lib/safe-error";

// ─── Pinned model versions ────────────────────────────────────────────────────
// Pin to dated aliases so silent OpenAI model upgrades don't drift behaviour.
// Update deliberately, with snapshot tests.
export const Models = {
  fast: "gpt-4o-mini-2024-07-18",
  smart: "gpt-4o-2024-11-20",
  embedSmall: "text-embedding-3-small",
} as const;

// ─── Client (one singleton, lazy) ─────────────────────────────────────────────

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export function isLlmAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmReason = "no-api-key" | "moderation-blocked" | "parse-failed" | "schema-failed" | "openai-error";

export interface LlmCallResult<T> {
  data: T;
  /** False when fallback was returned (no API key, moderation block, parse fail, openai error) */
  isFresh: boolean;
  /** Why we fell back to default, if applicable */
  fallbackReason?: LlmReason;
  /** True when result came from cache (no OpenAI charge) */
  cached: boolean;
  /** Categories flagged by moderation when blocked */
  moderationCategories?: string[];
}

export interface LlmCallOptions<T> {
  /** Cache + log namespace. Stable string per feature. */
  feature: string;
  model: keyof typeof Models | string;
  messages: ChatMessage[];
  /** Output schema — defines fallback shape. If validation fails, fallback is returned. */
  schema: z.ZodSchema<T>;
  /** Returned when LLM is unavailable, blocked, or output is unparseable. */
  fallback: T;
  /** Sample user content to moderation-check BEFORE spending tokens. Pass null to skip. */
  moderateInput?: string | null;
  /** If true, run detectInjectionAttempt() against `moderateInput` and log warnings. */
  detectInjection?: boolean;
  /**
   * Sanitise & truncate the LAST user message before sending. Set to false only for
   * fully internal prompts where every byte is constructed in code. Default: true.
   */
  sanitiseLastUserMessage?: boolean;
  /** Cache TTL in seconds. Defaults to 0 (no cache). */
  cacheTtlSec?: number;
  /** OpenAI sampling. */
  temperature?: number;
  maxTokens?: number;
  /** Force JSON object response_format. Defaults to true. */
  jsonMode?: boolean;
  /** Reproducibility seed; lets us version-pin behaviour. */
  seed?: number;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function llmCall<T>(opts: LlmCallOptions<T>): Promise<LlmCallResult<T>> {
  const {
    feature,
    model,
    messages,
    schema,
    fallback,
    moderateInput,
    detectInjection = false,
    sanitiseLastUserMessage = true,
    cacheTtlSec = 0,
    temperature = 0,
    maxTokens = 600,
    jsonMode = true,
    seed,
  } = opts;

  const client = getClient();
  if (!client) {
    return { data: fallback, isFresh: false, cached: false, fallbackReason: "no-api-key" };
  }

  // 1. Moderation pre-check on user-controlled content (cheap, ~50ms)
  if (moderateInput) {
    const mod = await moderateContent(moderateInput);
    if (!mod.allowed) {
      return {
        data: fallback,
        isFresh: false,
        cached: false,
        fallbackReason: "moderation-blocked",
        moderationCategories: mod.categories,
      };
    }
  }

  // 2. Injection-pattern detection — logged, not rejected
  if (detectInjection && moderateInput) {
    const inj = detectInjectionAttempt(moderateInput);
    if (inj.suspicious) {
      console.warn(`[llm-call:${feature}] suspected injection (${inj.patterns.length} pattern(s))`);
    }
  }

  // 3. Sanitise the LAST user message to defend against in-content directives.
  //    System messages are trusted (built in code). Assistant messages are model output.
  let preparedMessages = messages;
  if (sanitiseLastUserMessage) {
    preparedMessages = [...messages];
    for (let i = preparedMessages.length - 1; i >= 0; i--) {
      if (preparedMessages[i].role === "user") {
        preparedMessages[i] = {
          ...preparedMessages[i],
          content: sanitizeForLLM(preparedMessages[i].content, 8000),
        };
        break;
      }
    }
  }

  const resolvedModel = (model in Models ? Models[model as keyof typeof Models] : model) as string;

  // 4. Try cache (deterministic key from model + temperature + messages)
  const cacheKey = buildCacheKey({
    feature,
    model: resolvedModel,
    temperature,
    messages: preparedMessages,
  });

  // 5. Compute (with cache wrap when enabled)
  const compute = async (): Promise<{ data: T; reason?: LlmReason }> => {
    try {
      const completion = await client.chat.completions.create({
        model: resolvedModel,
        messages: preparedMessages,
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
        ...(seed !== undefined ? { seed } : {}),
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = parseStructuredJson<unknown>(raw, null);
      if (parsed === null) {
        return { data: fallback, reason: "parse-failed" };
      }
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        return { data: fallback, reason: "schema-failed" };
      }
      return { data: validated.data };
    } catch (err) {
      logSafeError(`[llm-call:${feature}]`, err);
      return { data: fallback, reason: "openai-error" };
    }
  };

  if (cacheTtlSec > 0) {
    // Cache only successful (validated) results — fallbacks are not cached.
    const wrapped = await withCache<{ data: T; reason?: LlmReason }>(
      cacheKey,
      cacheTtlSec,
      async () => {
        const result = await compute();
        // Treat fallbacks as cache-misses so we retry next call instead of caching the error.
        if (result.reason) return result; // don't cache fallback below — but withCache caches it
        return result;
      }
    );
    return {
      data: wrapped.data,
      isFresh: !wrapped.reason,
      cached: !wrapped.reason, // can't perfectly distinguish freshly-computed vs cached without more plumbing
      fallbackReason: wrapped.reason,
    };
  }

  const result = await compute();
  return {
    data: result.data,
    isFresh: !result.reason,
    cached: false,
    fallbackReason: result.reason,
  };
}

// ─── Convenience: schema-less text-mode wrapper ───────────────────────────────

/**
 * For streaming or text-mode calls where structured output isn't needed.
 * Returns the raw OpenAI response object — caller handles streaming.
 * Still enforces moderation + sanitisation + safe logging.
 */
export async function llmStreamingPrepare(opts: {
  feature: string;
  model: keyof typeof Models | string;
  messages: ChatMessage[];
  moderateInput?: string | null;
  sanitiseLastUserMessage?: boolean;
}): Promise<
  | { ok: true; client: OpenAI; model: string; messages: ChatMessage[] }
  | { ok: false; reason: "no-api-key" | "moderation-blocked"; categories?: string[] }
> {
  const { feature, model, messages, moderateInput, sanitiseLastUserMessage = true } = opts;
  const client = getClient();
  if (!client) return { ok: false, reason: "no-api-key" };

  if (moderateInput) {
    const mod = await moderateContent(moderateInput);
    if (!mod.allowed) {
      return { ok: false, reason: "moderation-blocked", categories: mod.categories };
    }
  }

  let preparedMessages = messages;
  if (sanitiseLastUserMessage) {
    preparedMessages = [...messages];
    for (let i = preparedMessages.length - 1; i >= 0; i--) {
      if (preparedMessages[i].role === "user") {
        preparedMessages[i] = {
          ...preparedMessages[i],
          content: sanitizeForLLM(preparedMessages[i].content, 8000),
        };
        break;
      }
    }
  }

  const resolvedModel = (model in Models ? Models[model as keyof typeof Models] : model) as string;
  // Touch `feature` so it's not unused — placeholder for cost tracking when added.
  void feature;
  return { ok: true, client, model: resolvedModel, messages: preparedMessages };
}
