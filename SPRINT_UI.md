# Sprint — Apple-grade UI redesign

Goal: take BlockBoost from "competent SaaS dashboard" to "feels like Apple
made it." The product's data and feature surface are already good. The
remaining gap is visual restraint, spacing discipline, fewer interaction
steps, and a consistent typographic system.

**Scoping rules (Rule 3, Rule 11 from CLAUDE.md):**
- Brand wordmark is BlockBoost. Don't rename anything.
- Page routes stay where they are. Only visual + interaction changes.
- Match existing Tailwind conventions when introducing new tokens.
- Trial on one page first (Overview) before rolling to the rest.

---

## Tier 1 — Spacing, hierarchy, restraint (~4-6 hours)

Biggest visual lift per hour. Do these before anything else.

### U1. Overview: hero + strip + details, not 5 stacked cards
**What's wrong:** Overview today renders 5 equal-weight sections stacked
vertically: NextActionCard → ScoreBreakdown → DriftCard → 4-tile stat
grid → Recent Scans + Quick Actions. Everything competes for attention.
First-time visitors don't know where to start.

**Change to:**
- **One hero card** (full width, generous padding): the headline AI
  Visibility score (`X/100 Low/Medium/Strong`) + the single most
  important recommended action below it.
- **One stat strip** (4 small inline tiles, no card backgrounds, just
  numbers + labels): Unbranded discovery %, branded recall %, total
  scans, competitors tracked.
- **One details panel** (collapsible): drift this week, recent scans,
  quick actions — all behind a "Show details" affordance or tabbed.

**Files:** `app/dashboard/page.tsx` + new
`components/dashboard/visibility-hero-card.tsx`.

**Acceptance:** an Overview that has at most 3 distinct visual blocks
on first view, with the hero card taking ≥50% of the vertical attention
budget.

### U2. One accent color, used sparingly
**What's wrong:** Indigo-600 is on every button, link, badge, hover state,
tile icon. Visual weight is uniform — nothing draws the eye to the actual
primary action.

**Change to:**
- Reserve `indigo-600` for **one primary action per page** (Run Scan,
  Generate Report, Save Changes).
- All secondary buttons → `border border-slate-200 text-slate-700` with
  no fill.
- All hover states → `hover:bg-slate-50` (no color shift).
- All badges → slate text with no fill background (just dot+text).

**Files:** sweep across `components/dashboard/*`, `components/ui/button.tsx`
might need a new `intent="secondary"` default. Probably best to grep for
`bg-indigo-` + `text-indigo-` and review case by case.

### U3. Hairline borders instead of shadows
**What's wrong:** Cards across the app use `shadow-sm` for elevation.
Apple's modern UI (Health, Wallet, Settings) uses no shadows — depth
comes from spacing around bordered rectangles.

**Change to:**
- Replace every `Card` `shadow-sm` with `border border-slate-100`.
- Keep `rounded-2xl` on the Card component.
- Increase padding inside cards from `p-5` to `p-6` to compensate for
  the lower visual weight.

**Files:** `components/ui/card.tsx` (the Card primitive) + sweep for
explicit `shadow-` usages in page-level components.

### U4. Smaller, lighter status badges
**What's wrong:** "Critical", "High impact", "Medium" badges on the
score breakdown card have bold pill backgrounds with colored fills.
Apple-style would be a tiny colored dot — color alone carries the
meaning.

**Change to:**
- Replace `<Badge className="bg-red-50 text-red-700 border-red-200">Critical</Badge>`
  with `<span className="flex items-center gap-1 text-xs text-slate-600"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Critical</span>`.
- Apply to: `score-breakdown-card.tsx`, `next-action-card.tsx`,
  `drift-card.tsx`, `gap-panel.tsx`, `segment-breakdown.tsx`,
  `prompt-table.tsx` (the Cited/Not-cited badges in particular).

### U5. Two font weights max per screen
**What's wrong:** Mixed `font-bold` + `font-semibold` + `font-medium` +
`font-normal` across the same page. Apple uses 2 weights: semibold for
headlines, regular for body. Size differentiates, not weight.

**Change to:**
- Audit all uses of `font-bold` — most become `font-semibold`.
- All `font-medium` → `font-normal` unless inside a heading.
- Establish 4 type sizes (display=24px, heading=18px, body=14px,
  caption=12px) and don't add more.

**Files:** create `lib/typography.ts` with named token classes
(`display`, `heading`, `body`, `caption`) and replace inline `text-*`
usages.

---

## Tier 2 — Minimize interactions (~2-3 hours)

User-flow improvements. Each one removes a step the user shouldn't have
needed.

### U6. Auto-refresh, kill "Refresh" buttons
**What's wrong:** DriftCard, Alerts page, AI Bot Traffic page each have
a manual Refresh button users never click. Data freshness should be a
system concern.

**Change to:**
- Add SWR or `revalidateOnFocus`-style polling (30s) to the relevant
  client components.
- Remove the visible Refresh button. Keep the action in case of dev
  debugging via a hidden hotkey (`Cmd+R` works natively).

**Files:** `components/dashboard/drift-card.tsx`,
`components/competitors/gap-panel.tsx`, `components/entities/entity-list.tsx`,
ai-bot-traffic page.

### U7. Inline Report period picker, no modal
**What's wrong:** Click Reports → click "Generate Report" → modal opens
→ pick period → click "Generate Report" again. Three clicks for a
one-knob decision.

**Change to:**
- Render the period picker inline on the Reports page (4 small buttons:
  7d / 30d / 90d / Custom). Default to 30d.
- Single "Generate" button that uses the currently-selected period.
- No modal at all. Show progress as an inline spinner row that animates
  through "Fetching → Calculating → AI narrative → Done".

**Files:** `components/dashboard/generate-report-modal.tsx` → split into
inline component, hook into existing `/api/reports/generate` route.

### U8. Single-action "Report ready" state
**What's wrong:** Generate succeeds → modal shows three buttons (View
report, Copy link, Close). User has to read all three to know what to do.

**Change to:**
- On success, auto-copy the share link to clipboard, show a toast
  "Link copied — view your report →" with the URL as a single click target.
- The toast dismisses itself after 8 seconds.
- No modal at all.

**Files:** same as U7 plus `lib/clipboard.ts` (new helper).

### U9. iOS-style stacked Settings list
**What's wrong:** Settings has 6 tabs (Profile / Notifications / Billing /
Security / Integrations / Emails) on a horizontal tab strip. Doesn't
scale, looks crowded on mobile, doesn't match the "browse" mental model
of settings.

**Change to:**
- Replace tab strip with a vertical list of cards. Each card title is
  the section name, with a chevron, opens the section on click.
- Section content is full-page with a back chevron (top-left), like
  iOS Settings.
- URL still uses `?tab=` for back-button compat.

**Files:** `app/dashboard/settings/page.tsx`.

---

## Tier 3 — Polish details (~1 day)

Do these last. Each one alone is minor but compound effect is what makes
the UI feel premium.

### U10. System font stack
- In `app/globals.css`, replace any custom font-family with
  `font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;`
- Uses each OS's native font (San Francisco on Apple, Segoe on Windows).
  Instant familiarity, no extra font weight to download.

### U11. Consistent `rounded-2xl` (16px) everywhere
**Audit:** today the codebase mixes `rounded-md`, `rounded-lg`,
`rounded-xl`, `rounded-2xl`. Apple's signature is one corner radius.
- Pick `rounded-2xl` for cards and modals.
- `rounded-lg` for buttons and inputs.
- `rounded-full` for avatars and dot indicators.
- Replace everything that doesn't fit one of those.

### U12. SF Symbols-style stroke icons
- Current icon set: `lucide-react`. Solid + outlined mix.
- Swap for `@iconify/sf-symbols` (or `react-icons/sf`) for an Apple feel.
  Alternatively keep lucide and force `strokeWidth={1.5}` everywhere
  for a thinner, more uniform look.
- Apply consistent icon sizes: 14px (inline with text), 16px (button),
  20px (section header).

### U13. Numeric typography niceties
In `globals.css`, add:
```css
.tabular-nums { font-variant-numeric: tabular-nums; }
.body-text { font-feature-settings: "ss01", "ss02", "cv05"; }
```
Apply `.tabular-nums` to every metric (so 100% and 5% line up
vertically). The `cv05` SF stylistic alternate makes lowercase L look
distinct from uppercase I — important when showing brand names.

---

## Suggested execution

**Session 1 — Tier 1 trial on Overview only (~4 hours)**
Ship U1+U3+U4 on `/dashboard` Overview as a one-page redesign. Review
together. If it feels right, scale to other pages. If not, adjust the
direction before sinking more time.

**Session 2 — Tier 1 rollout to remaining pages (~3 hours)**
Apply U2+U5+U3 sweep across AI Visibility, Citations, Competitors,
Brand Knowledge, AI Brand Files, Audit Tool. Skip admin pages for now
(low user visibility).

**Session 3 — Tier 2 interaction reductions (~2-3 hours)**
U6 + U7 + U8 in one batch. All three are independent of the visual
sweep.

**Session 4 — Tier 3 polish (~1 day)**
U10 + U11 + U12 + U13. Last because they're easier once the structure
is right, harder to motivate before.

---

## What's deliberately out of scope

- **Renaming the product.** Brand stays BlockBoost.
- **Page route changes.** No URL restructuring; `/dashboard/entities` stays
  even though the sidebar label is "Brand Knowledge".
- **Admin pages.** Internal tool, low ROI on polish.
- **Email template redesign.** Separate sprint, different design rules
  (email-safe CSS, tables instead of flexbox).
- **Landing page (`app/page.tsx`).** Marketing surface, different audience,
  different constraints. Treat as a separate sprint.

---

## Open questions for the user before starting

1. **Hero card content for U1** — should it be:
   - (a) Just the headline number with a recommended-action button below,
   - (b) The number + a one-line narrative ("AI sees PlutoxAI as Web3
     when it's an AI content tool — fix the 0% unbranded discovery"),
   - (c) Something else?
2. **Tier 2 U7** — defaulting Generate Report to 30d means most users
   never see Custom Range. Acceptable, or keep Custom Range visible
   as a third equal option?
3. **U12 SF Symbols** — they're a paid Apple asset. Open-source
   alternatives (`@iconify/sf-symbols`, `react-icons/sf`) exist but
   aren't 100% identical. OK to use the open-source mirror?
