# Digital Command — Build Progress

Last updated: Phase 3 build.

## Phase 1 — ✅ Complete
## Phase 2 — ✅ Complete

Full detail in this file's git history. Summarized: Phase 1 = branding, auth, multi-tenant DB+RLS, registration, verification, manual payment, Super Admin approval → activation. Phase 2 = Brand Brain, links, real Claude-powered 7-Day Planner with Autopilot/Approval Required, notifications.

## Phase 3

### ✅ Completed (built and verified — lint/build clean, new routes confirmed to render/guard correctly in-browser)

- **Real technical SEO crawl audit** (`/app/seo`) — robots.txt, sitemap.xml, on-page checks (title/meta description/canonical/viewport/h1/schema/image alt text), a ~10-link internal broken-link sample, weighted 0–100 score. No external account needed — works against any client's website immediately.
- **Real Google OAuth** for Search Console and Analytics — full authorization-code flow with CSRF `state` protection, token exchange, and automatic refresh (`getValidAccessToken`)
- **Real data sync** — "Sync Now" pulls actual Search Console query/page performance and actual GA4 sessions/users/conversions on demand, stored as timestamped snapshots (never overwritten, enabling trend comparisons)
- **Keyword tracking** — real Search Console query data, period-over-period position deltas (▲/▼), no separate paid rank-tracker
- **Reports** (`/app/reports`) — on-demand generation combining real SEO/Search-Console/Analytics/planner numbers with an AI-written narrative (`generateReportNarrative`) explicitly instructed to only use the given numbers, never invent a metric or promise guaranteed results
- Dashboard: SEO and Reports are now real `ModuleLinkCard`s, not placeholders
- `npm run lint` — clean; `npm run build` — clean full production build + type check
- Route guards re-verified in-browser: `/app/seo`, `/app/reports`, and both `/api/google/oauth/*` routes correctly redirect unauthenticated visitors

### 🟡 Built, needs a live Supabase project + a real Google Cloud OAuth app to verify end-to-end

- The full OAuth connect → property-pick → sync flow (code is complete and reviewed; needs real Google credentials and a live client site/property to exercise)
- Report generation against real multi-period data (needs at least two snapshots/audits to show meaningful deltas)

### ⬜ Not started (explicitly out of Phase 3 scope, by design)

- **Competitor tracking** — explicit user decision to defer rather than start a new paid Semrush/Ahrefs-style vendor relationship without sign-off first (spec §36)
- Actual publishing (Phase 4/Buffer) — still unchanged from Phase 2's scope note
- Off-Page SEO, YouTube management, Local SEO/GBP (Phase 4/5)
- Automated/cron-scheduled report generation or SEO re-audits (on-demand only, same reasoning as Phase 2's Autopilot — no hosting decision made yet, spec §37.3)
- A dedicated cost/rate cap on AI report-narrative generation (the planner's caption cap doesn't cover this new call path — flagged in `SECURITY_AND_RLS.md`)

### 🔴 Blocked

- None currently.

### ⚠️ Needs external setup / verification (owner action required — read `supabase/README.md` §5 first)

- **Create a Google Cloud OAuth app** (Search Console API + Analytics Data/Admin APIs enabled, OAuth consent screen with `webmasters.readonly` + `analytics.readonly` scopes, redirect URI set) and add `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
- **Add your own Google account as a Test User** on the OAuth consent screen to develop/demo against before Google's app verification completes — this is a real external timeline (days to weeks), not something skippable
- Run migrations `0008`–`0009` against the same Supabase project as Phases 1–2
- With real data: connect a real property, sync, generate a report, and sanity-check the AI narrative never states a number that isn't actually in `metrics_snapshot`
- Decide whether/when to add an AI-cost cap to report generation before real client traffic
- Decide on a competitor-tracking data provider whenever that becomes a priority (see `API_INTEGRATIONS.md`)
