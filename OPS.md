# Operations playbook

This is the survival kit for keeping VisibilityIQ alive in production.

## Required production env vars

These must exist in Vercel → Project Settings → Environment Variables for the
app to function end-to-end. Missing any of the **critical** ones causes silent
failure (no crash, no obvious error in the UI).

### Critical (app won't function without these)

| Var | Used for | Failure mode if missing |
|---|---|---|
| `DATABASE_URL` | Supabase pooler connection | Every DB query throws |
| `NEXTAUTH_URL` | Cookie domain, callbacks | OAuth flows redirect to wrong domain |
| `NEXTAUTH_SECRET` | JWT signing | Sessions can't be created |
| `OPENAI_API_KEY` | LLM + embeddings | All AI features fail silently |
| `APIFY_TOKEN` | Web scanning | Scans can't run |
| `RESEND_API_KEY` | Transactional email | No verification emails sent |
| `CRON_SECRET` | Vercel cron auth | **All 5 crons fail with HTTP 500** (the 2026-05-15 production outage) |
| `EMAIL_UNSUBSCRIBE_SECRET` | HMAC for unsubscribe + reset-password tokens | Reset password breaks |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for PDFs | Report PDFs don't save |

### Optional (feature is hidden if not set)

| Var | Feature gated |
|---|---|
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google sign-in. Middleware redirects `/api/auth/signin/google` to `/auth/login` when missing |
| `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET` + `SLACK_REDIRECT_URI` | Slack alerts. Hidden via `FEATURES.slack` flag |
| `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` | Reddit social listening |
| `NEXT_PUBLIC_CALENDLY_URL` | Calendly upgrade-call button |
| `TURNSTILE_SECRET` + `TURNSTILE_SITEKEY` | Captcha on signup. Bypassed if unset |

### Feature flags (gate UI for incomplete features)

| Var | Default | Effect |
|---|---|---|
| `NEXT_PUBLIC_FEATURE_GOOGLE` | unset (off) | Show "Continue with Google" button (also requires `GOOGLE_CLIENT_ID`) |
| `NEXT_PUBLIC_FEATURE_SLACK` | unset (off) | Show Slack integration in settings |
| `NEXT_PUBLIC_FEATURE_SOCIAL` | unset (off) | Show Social Listening sidebar entry |

## Vercel crons

Five crons run on schedules defined in `vercel.json`. All require
`Authorization: Bearer ${CRON_SECRET}` — without it, every cron call returns
HTTP 500 (the route checks `process.env.CRON_SECRET` first).

| Path | Schedule | What it does |
|---|---|---|
| `/api/cron/daily-scan` | `0 6 * * *` | Runs Apify visibility scan for every project at the cadence allowed by each user's plan |
| `/api/cron/visibility-decay` | `0 10 * * *` | Detects week-over-week visibility drops; creates `MENTION_RATE_DROP` Alert |
| `/api/cron/weekly-report` | `0 8 * * 1` | Generates + emails monthly PDF reports to Growth+ subscribers (Monday morning) |
| `/api/cron/resume-paused` | `0 7 * * *` | Resumes paused subscriptions whose pause period has elapsed |
| `/api/cron/email-sequence` | `0 9 * * *` | Sends activation-sequence emails based on signup state |

**Hobby plan note:** Vercel Hobby allows only 2 crons and daily-only schedules.
This project requires a Pro plan or higher.

### Manually triggering a cron (testing)

```bash
curl -X GET "https://visibilityiq.vercel.app/api/cron/visibility-decay" \
  -H "Authorization: Bearer $CRON_SECRET"
```

The route also writes a `CronRun` row — query that table to confirm.

## Tracking cron health

```sql
SELECT name, status, "startedAt", "durationMs", error
FROM "CronRun"
ORDER BY "startedAt" DESC
LIMIT 20;
```

If `count(*) = 0` for any cron over 24 hours, Vercel isn't firing it.
Check Vercel → Project → Settings → Crons.

## "The product has no data" playbook

If real users say the dashboard is empty even after using the product:

1. Run the cron health query above. Zero runs = Vercel cron broken (usually
   missing `CRON_SECRET` or plan downgrade).
2. Query `Mention` table — if 0 rows but users exist with Projects, the scan
   trigger isn't producing data. Check Apify API token validity in Vercel env.
3. Check `EmailSent` table — if 0 rows, Resend isn't being called or API key
   is invalid.
4. Hit `/api/cron/visibility-decay` manually with the bearer token. If 500,
   `CRON_SECRET` is missing in prod.

## Sprint 1 intent backfill

Existing prompts created before commit `e0501d4` won't have `intent` populated.
After deploying, hit:

```bash
curl -X POST "https://visibilityiq.vercel.app/api/admin/backfill-intent" \
  -H "Authorization: Bearer $CRON_SECRET"
```

This is idempotent — re-running is safe.

## Common gotchas

- **`prisma db push` against the pooler URL fails.** Use the direct connection
  (port 5432, not 6543) for migrations.
- **`@prisma/dev` transitive CVEs.** These show in `npm audit` but are dev-only;
  do not `audit fix --force` (would downgrade Prisma to v6).
- **Next.js 16.2.4 CVEs.** Documented in npm audit but no stable fix available
  (only canary versions). Accept the risk until Next 17 or 16.3 ships stable.

## Security contact

- `/.well-known/security.txt` points to security@visibilityiq.com.
- All admin routes are wrapped in `adminRoute()` HOF — see `lib/admin-auth.ts`.
- Admin actions are audit-logged via `lib/audit.ts logAudit()`.
