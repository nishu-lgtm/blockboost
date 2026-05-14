# Handoff — start of next session

> **Read first:** `~/.claude/projects/-Users-nishu/memory/feedback_visibilityiq_engineering_rules.md` — 12-rule template governs every task.
> Budget (raised 2026-05-15): **5,000/task · 37,500/session**.

## State of the product

- **Live:** https://visibilityiq.vercel.app
- **Repo:** https://github.com/nishu-lgtm/blockboost (`main`)
- **DB:** Supabase pgvector — `dehztchdikghcxplnffq`
- **Tests:** `npm test` → **35/35 pass**, all `node:test` via `tsx`
- **TS:** clean (use `NODE_OPTIONS='--max-old-space-size=4096' npx tsc --noEmit`)
- **Last commit:** `cd7f9cf` — Sprint 7 visibility-decay cron live

## Sprint progress (graph status)

```
✅ Sprint 1 (Query Intent)              — 6 commits, live
✅ Sprint 2 (Consensus + Confidence)    — 5 commits, live
✅ Sprint 7 (Visibility Decay)          — 3 commits, live
⏳ Sprint 3 (Embeddings)                — BLOCKS Sprints 4, 5, 6, 9
⏳ Sprint 4 (Retrieval Sim)             — needs Sprint 3 + pgvector
⏳ Sprint 5 (Entity Graph)              — needs Sprint 4
⏳ Sprint 6 (Delivery Files)            — needs Sprint 5
⏳ Sprint 8 (AI Bot Analytics)          — independent, no deps
⏳ Sprint 9 (AI Retrieval Planner)      — needs 1, 4, 5
```

## Two paths for the next session

### Path A — Sprint 8 (AI Bot Analytics) · ~6-8 hr
- Independent track. No OpenAI dep. Self-contained.
- Tracking pixel (`public/track.js`) + ingestion endpoint + dashboard view.
- Tables: new `AiBotVisit { projectId, botName, userAgent, url, timestamp }`.
- Use this if **OpenAI credits still exhausted** (currently are — `insufficient_quota`).

### Path B — Sprint 3 (Embeddings) · ~4 hr
- Unblocks the moat (Sprints 4, 5, 6, 9).
- New `lib/embeddings.ts` (wrapper for `text-embedding-3-small` + cosine sim).
- Replaces `lower.includes(brand)` in `lib/mention-parser.ts`.
- **Requires OpenAI credits.** Currently exhausted — add credits at https://platform.openai.com/account/billing first (set $50 hard cap).

## Hard prerequisites still pending

| Service | Status | Needed for |
|---|---|---|
| OpenAI credits | ❌ exhausted | Sprint 3, 5, 6, 9 |
| Supabase pgvector extension | not enabled | Sprint 4 |
| Apify | ✅ working (3 actors verified) | already in use |

## Verify baseline before any new work

```bash
cd /Users/nishu/visibilityiq
git log --oneline -5             # last commit should be cd7f9cf or later
npm test                          # 35/35 must pass
NODE_OPTIONS='--max-old-space-size=4096' npx tsc --noEmit  # silent
```

If any fails, stop and surface (Rule 12). Don't proceed with new work on a broken baseline.

## Conventions (Rule 11 — match these, don't fork)

- AI calls go through `lib/llm-call.ts llmCall()` — never `openai.chat.completions.create()` directly
- Models pinned via `Models.fast` / `Models.smart` (`lib/llm-call.ts`)
- Domain classification: `lib/source-tiers.ts tierForDomain()` — don't make new domain lists
- Errors: `lib/safe-error.ts logSafeError()` — never bare `console.error(err)`
- Per-user AI quota: `lib/ai-quota.ts consumeAiQuota()` on every authenticated AI-spending endpoint
- Tests: `lib/*.test.ts` next to the file, `node:test` + `assert/strict`
- One logical change per commit (Rule 3)
- Each test name encodes WHY (Rule 9)
- Brand: **BlockBoost** (folder name `visibilityiq` is internal only)
- Brand logo: `<BrandLogo>` from `components/brand-logo.tsx` (amber + Zap)

## Notes for the next sprint

**For Sprint 8 (Bot Analytics):**
- Read `app/api/audit/public/route.ts` first — it's the only existing endpoint that accepts unauthenticated traffic and rate-limits by IP. Mirror that pattern for `/api/track/visit`.
- AI bot UA list to detect: `GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, `Bytespider`, `CCBot`, `Google-Extended`.
- Dedupe key: `(projectId, botName, url, day)` — one row per bot per URL per day.
- Stop after the tracking pixel + ingest endpoint work end-to-end against a real curl call. Then dashboard UI as a separate commit.

**For Sprint 3 (Embeddings):**
- Use `Models.embedSmall` constant in `llm-call.ts` (already exists).
- Embedding API call shape is different from chat — `llmCall` doesn't cover it yet. Decide: extend wrapper OR write a sibling `embedCall()` helper. Prefer sibling (Rule 2, simpler) — embeddings have no schema/moderation needs.
- Test fixture approach: hand-roll 1536-dim embedding vectors for a few known brand variations so we can test cosine-similarity behavior without OpenAI credits.

## Cleanup todos (delete when ready)

- Run the admin backfill once OpenAI returns: POST `https://visibilityiq.vercel.app/api/admin/backfill-intent` with admin auth → backfills `Prompt.intent` for any rows that pre-date Sprint 1 step 3.
- Delete `app/api/admin/backfill-intent/route.ts` once that's done — one-off migration code.
- 6 test users in production DB (`pooler-test-*`, `whitespace-test@`, `mixedcase@`, `post-sec-deploy@`, `repro-test-*`, `postfix-test-*`) — delete from Prisma Studio when convenient.
