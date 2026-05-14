# Handoff — start of next session

> **Read me first.** This file exists so a fresh Claude session can pick up
> Sprint 1 of the AI Citation + Retrieval vision without re-discovering
> everything that has been done.

## Project rules (governing convention)

**Open `~/.claude/projects/-Users-nishu/memory/feedback_visibilityiq_engineering_rules.md` first.**
The user set a 12-rule template that applies to every task in this project.
Highlights: simplicity first, surgical changes, one logical commit at a time,
fail loud, never blend conflicting patterns. Self-audit each commit against
the 12 rules and surface violations.

## State of the product

- **Live**: https://visibilityiq.vercel.app
- **Repo**: https://github.com/nishu-lgtm/blockboost (branch: `main`)
- **DB**: Supabase pgvector instance — `dehztchdikghcxplnffq` (pooler URL in `.env`)
- **Status of auth/signup/login/billing flows**: stable, verified by curl smoke tests
- **Last commit**: `f4a3e0e` — added tests for llm-call + llm-safety (Rule 9 fix)

## What was just shipped (last 4 commits)

| Commit | Purpose |
|---|---|
| `ca4a6f9` | New `lib/llm-call.ts` wrapper · migrated `mention-parser.classifySentiment` · added quota gate to citations route · bridged `classifyDomain` → `tierForDomain` · replaced bare `console.error(err)` with `logSafeError` in 5 sites |
| `c2bd64d` | Removed unused `llmStreamingPrepare` export from llm-call (Rule 2) |
| `f4a3e0e` | Added 12 intent-encoding tests for llm-call + llm-safety; fixed injection regex that missed "ignore all previous prompts" |

## External blockers BEFORE Sprint 1 work

| Service | Status | Action by user |
|---|---|---|
| OpenAI API | ❌ quota exhausted (`insufficient_quota`) | Add credits at https://platform.openai.com/account/billing — set $50 hard cap + 50%/90% email alerts. **Sprint 1 (Query Intent) doesn't strictly need this** because there's a deterministic-rule fallback, but Sprint 3+ does. |
| Apify | ⚠️ Free plan, 0 runs to date, ~$5/mo credit | Sufficient for Sprints 1+2 testing. Multi-pass consensus (Sprint 2) costs ~3× per scan. |
| Supabase pgvector | Not enabled | Enable for Sprint 4: Supabase dashboard → Database → Extensions → `vector` (1 click). NOT needed before Sprint 4. |
| Vercel/Resend | OK | Sufficient. |

## Sprint plan (from previous session)

Pick up where the user left off: **Sprint 1 — Query Intent Classifier**.

### Sprint 1 success criteria

- Add `intent` enum to `Prompt` Prisma model:
  `DISCOVERY | COMPARISON | COMMERCIAL | PROBLEM | RECOMMENDATION`
- New `lib/query-intent.ts` with `classifyIntent(text: string): Intent`
  - Rules-first (90% coverage):
    - contains "vs" or "compared to" → COMPARISON
    - contains "best ... under $" / "price" / "cheapest" → COMMERCIAL
    - starts with "how to" / "how do" / "why" → PROBLEM
    - contains "best ... in {city}" or pure "best X" → DISCOVERY
    - contains "what do people recommend" / "recommendations for" → RECOMMENDATION
  - Optional GPT-mini fallback for ambiguous prompts (wire through `llmCall`)
- Migrate all existing Prompt rows: backfill `intent` via the classifier
- Update `/api/projects/suggest-prompts` to return a balanced mix of all 5 types
- UI change to `app/dashboard/ai-visibility/page.tsx`: show mention rate broken out per intent type
- Tests in `lib/query-intent.test.ts` — 20 sample prompts, anchor classifier accuracy ≥ 95% recall on rules + correct intent on each

### Order of work (per Rule 3 — one logical change per commit)

1. **Schema migration only**: add `intent` enum + nullable column, push to Supabase, commit.
2. **Classifier + tests**: write `lib/query-intent.ts` + `lib/query-intent.test.ts`, run `npm test`, commit.
3. **Backfill existing prompts**: small one-off script or admin route, commit.
4. **Suggest-prompts update**: balanced mix, commit.
5. **UI**: visibility-per-intent breakdown, commit.
6. **TS check + smoke test on live**, then deploy.

### After Sprint 1: Sprint 2 — Multi-pass Consensus + Confidence

(Don't start in this session — checkpoint after Sprint 1 lands, restart for Sprint 2.)
Schema additions: `Mention.runCount`, `Mention.consensusRate`, `Mention.confidence`.
Logic: run each scan N=3 times per platform via existing Apify wrapper, dedupe by `(promptId, platform, brandMentioned)`, mark mention if ≥2/3 agree. Cost: ~3× Apify per scan.

## How to verify yourself before doing anything destructive

```bash
cd /Users/nishu/visibilityiq
npm test                # all 12 tests should pass
npx tsc --noEmit        # should produce no output
git log --oneline -5    # confirm you're at f4a3e0e or later
```

If any of those fail, stop and surface (Rule 12) — do NOT proceed with new work on a broken baseline.

## Conventions to mirror (Rule 11)

- API routes that touch OpenAI go through `lib/llm-call.ts llmCall()` — do NOT instantiate OpenAI directly
- Domain classification uses `lib/source-tiers.ts tierForDomain()` — do NOT create new domain lists
- Error logging uses `lib/safe-error.ts logSafeError()` — never bare `console.error(err)`
- Per-user AI quota goes through `lib/ai-quota.ts consumeAiQuota()` on every authenticated AI-spending endpoint
- New tests go in `lib/*.test.ts` next to the file, using `node:test` + `assert/strict` (no new framework)
- Brand name in user-facing copy is **BlockBoost** (folder name `visibilityiq` is internal only)
- Brand logo is `<BrandLogo>` from `components/brand-logo.tsx` (amber + Zap)
