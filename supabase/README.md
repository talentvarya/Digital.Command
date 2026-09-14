# Digital Command — Supabase setup

## 1. Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**. Free tier is fine to start.
2. **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, keep secret)
3. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com) → `ANTHROPIC_API_KEY` (server-only). Powers the 7-Day Planner's AI caption generation and (Phase 3) report narratives.
   - Optional (post-Phase 7): get a Moonshot AI (Kimi) key at [platform.kimi.ai](https://platform.kimi.ai) → `MOONSHOT_API_KEY`, and set `AI_PROVIDER=kimi` to switch generation over to it. Claude stays the default when either is left unset — see `../ARCHITECTURE.md`'s "AI Provider Abstraction" section.
4. Set up a Google Cloud OAuth app for `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (Phase 3+, powers `/app/seo`'s Search Console + Analytics + YouTube connections) — see `../.env.example` for the exact steps. **Read the note in step 5 below before spending time on this** — it has a real timeline implication.
5. Get a Buffer personal API key for `BUFFER_ACCESS_TOKEN` (Phase 4, powers Facebook/Instagram publishing) — **this is VMG's own Buffer account, not something each client sets up.** See `../.env.example` for exactly why (Buffer's current API doesn't support per-client OAuth) and the steps.
6. Set up a Google Programmable Search Engine for `GOOGLE_CUSTOM_SEARCH_API_KEY`/`GOOGLE_CUSTOM_SEARCH_ENGINE_ID` (Phase 5, powers `/app/outreach`'s brand-mention search) — see `../.env.example` for the steps. Free tier, no vendor sign-off needed.
7. Nothing new to set up for Phase 6 — paid campaign drafting reuses the same `ANTHROPIC_API_KEY` from step 3. There is no Google Ads/Meta API credential anywhere in this app; launching a campaign is a manual step VMG staff does directly on the ad platform (see `../PROJECT_PLAN.md`'s Phase 6 section).
8. Nothing new to set up for Phase 7 either — the AI Assistant and cost-dashboard usage tracking both reuse `ANTHROPIC_API_KEY`; conversion tracking, Master STOP/Emergency Freeze, the Connection Health Center, and offboarding are all pure application logic with no new external credential.

Copy `../.env.example` to `../.env.local` and fill these in.

## 2. Run the migrations, in order

**SQL Editor → New Query**, paste and run each file in this exact order (they depend on each other):

1. `migrations/0001_schema.sql` — tables, enums, triggers
2. `migrations/0002_rls.sql` — row-level security policies
3. `migrations/0003_storage.sql` — private storage buckets + policies
4. `migrations/0004_seed.sql` — plan pricing + draft policy text
5. `migrations/0005_phase2_schema.sql` — Brand Brain, links, planner, notifications tables
6. `migrations/0006_phase2_rls.sql` — Phase 2 row-level security policies
7. `migrations/0007_phase2_storage.sql` — Phase 2 storage buckets + policies
8. `migrations/0008_phase3_schema.sql` — SEO audits, Google connections, report tables
9. `migrations/0009_phase3_rls.sql` — Phase 3 row-level security policies
10. `migrations/0010_phase4_schema.sql` — Buffer channel links, content publish-tracking columns, `youtube` service
11. `migrations/0011_phase4_rls.sql` — Phase 4 row-level security policies
12. `migrations/0012_phase5_schema.sql` — off-page opportunities, outreach messages, brand-mention searches
13. `migrations/0013_phase5_rls.sql` — Phase 5 row-level security policies
14. `migrations/0014_phase6_schema.sql` — paid campaigns + approval records
15. `migrations/0015_phase6_rls.sql` — Phase 6 row-level security policies
16. `migrations/0016_phase7_schema.sql` — AI usage tracking, conversion tracking, system settings (Emergency Freeze), offboarded/sandbox markers, two Phase-1/2 bug fixes (see §7 below)
17. `migrations/0017_phase7_rls.sql` — Phase 7 row-level security policies, including the `client_settings` owner-update fix
18. `migrations/0018_fix_org_select_on_create.sql` — fixes a bug found during the first live-database verification pass that blocked registration from ever completing (see `PROJECT_PLAN.md`'s "Live database verification" section and `SECURITY_AND_RLS.md`)
19. `migrations/0019_ai_provider_tracking.sql` — adds `ai_usage_events.provider` (`anthropic`|`kimi`), post-Phase 7, for Kimi as a second AI provider

(Equivalently, if you use the Supabase CLI: `supabase db push` after linking the project, with these files under `supabase/migrations/`.)

## 3. Create the first Super Admin

There is no self-serve Super Admin signup — by design, every new signup becomes a `client_owner`.

1. **Authentication → Users → Add User** — enter your email/password, check **Auto Confirm User**.
2. **SQL Editor**, run:
   ```sql
   update public.profiles set role = 'super_admin' where id = '<the new user's UUID from step 1>';
   ```
3. Log in at `/login`. On first Super Admin login you'll be required to enroll TOTP MFA (via `/admin/mfa-setup`) before reaching the admin dashboard — this is mandatory per the spec and uses Supabase Auth's built-in MFA, no third-party service needed.

## 4. Verify isolation

After registering two separate test client accounts, confirm each can only see their own organization's data (this is what the RLS policies in `0002_rls.sql` enforce) — this is the most important thing to check before onboarding a real client.

## 5. Google OAuth verification timeline — read before you invest time in this

The Search Console (`webmasters.readonly`), Analytics (`analytics.readonly`), and YouTube (`youtube.upload`, `youtube.readonly`) scopes are Google-classified as **sensitive**. Until your OAuth app passes Google's verification review, **only Google accounts you've explicitly added as Test Users** on the OAuth consent screen (Google Cloud Console → APIs & Services → OAuth consent screen → Test users) can complete a connection — anyone else sees an "app not verified" block. Verification can take anywhere from same-day to a few weeks depending on Google's review queue and whether they ask for more information. This is a real external dependency (master spec's own open item §37.13), not something to schedule around casually if you want real clients connecting soon — start the verification process early, and use Test Users to develop/demo against in the meantime.

## 6. Buffer setup — this is VMG's account, not each client's

1. If you don't already have one, create a Buffer account at [buffer.com](https://buffer.com) with a plan that supports API access.
2. **Settings → API** → create a personal API key → `BUFFER_ACCESS_TOKEN`.
3. For each client, add their Facebook Page and/or Instagram account as a **channel** on buffer.com (this step requires the client to authorize via their own Facebook login when you connect it — it happens on Buffer's site, not in Digital Command).
4. In Digital Command, go to **Admin → Clients → [that client] → Publishing Channels** and link the channel you just added to the right org + platform. Content the client approves (or Autopilot auto-schedules) then publishes through it automatically.

## 7. Backups (spec §24) — what Supabase already gives you vs. what this app adds

Digital Command's own code does not reimplement database or file backup — that's Supabase's job, and duplicating it would be worse than what the platform already does well. What it does add is real, on-demand **content version history + restore** (`/app/planner` → History on any item) — that's genuinely new, built on the append-only `content_versions` table.

For the infrastructure half:
- **Database backups**: the Free tier keeps backups for a short rolling window; **Point-in-Time Recovery (PITR)** — the ability to restore to any specific moment, not just a daily snapshot — is a **Pro-tier** feature. Upgrade before you're depending on this for real client data.
- **Storage (file) backups — the specific gotcha the spec is warning about**: a database backup/`pg_dump` captures the `storage.objects` **table rows** (file paths, metadata) — it does **not** include the actual file bytes sitting in a storage bucket. Verification documents, payment screenshots, brand assets, and planner media all live in Storage, not Postgres tables, so they need their own backup path (e.g. periodically syncing the 4 buckets to external object storage) — not yet automated here, since it needs the same recurring-job infrastructure the still-open hosting decision (spec §37.3) blocks everything else on. Until then, treat anything in Storage as only as durable as Supabase's own bucket redundancy.

## What's NOT included yet

- Real KYC/Aadhaar/PAN verification API — only stores uploaded documents for a human (Super Admin) to review. Wiring a verification provider is an open item in the master spec (§37.1/§37.2).
- Email receipts/notifications (spec §20) and automated outreach sending (spec §9.2) — deferred to a later phase for receipts; outreach deliberately always sends through the user's own email client (a pre-filled `mailto:` link), not automatically.
- Final legal-reviewed policy text — `0004_seed.sql` seeds clearly-labeled DRAFT placeholder copy.
- Unattended/cron-based Autopilot — generation is on-demand (button click) until a hosting decision unlocks a serverless cron (spec §37.3 is still open).
- Competitor tracking, and the backlink-index-class parts of off-page SEO (web-wide opportunity discovery, competitor backlink analysis, local citations, digital PR) — deferred by explicit choice, asked twice (Phase 3 and Phase 5), rather than starting a new paid SEO-data vendor relationship without sign-off (spec §36). Keyword tracking (Search Console-based) and the human-seeded off-page opportunity pipeline (crawl + AI assessment + outreach + backlink verification) are both real.
- Google Business Profile — needs a separate, stricter Google access-request approval (a 60+-day-old verified profile, a business website, formal review) that can't even be developed against without approval, unlike Search Console's Test-User workaround. Revisit once you have an eligible profile.
- Live Google Ads/Meta Marketing API access — paid campaigns are fully prepared, budgeted, and approved in Digital Command (`/app/paid-campaigns`), but actually creating/launching the campaign on the ad platform is a manual step done directly in Google Ads/Meta's own dashboard, then recorded back in Digital Command by a Super Admin. Deliberate, not a gap — see `../PROJECT_PLAN.md`'s Phase 6 section for the access-requirement research behind this decision.
- Real data deletion/purge on offboarding — `/admin/clients/[orgId]`'s Offboarding action revokes Google tokens for real, disconnects Buffer channel links, cancels not-yet-sent scheduled content, exports the client's data, and marks the org `offboarded`, but never deletes a row. The spec names no retention period, so a deletion trigger isn't something this build could implement without guessing at one — explicit, informed user decision (see `../PROJECT_PLAN.md`'s Phase 7 section).
- Offboarding's Buffer disconnect only removes Digital Command's own link to the channel — it does not remove the channel from VMG's actual Buffer account (no API exists for that, same class of gap as every other Buffer API limitation documented in Phase 4). The admin UI says so explicitly; still requires a manual step on buffer.com.
- Real Rate-Limited detection in the Connection Health Center — `lib/buffer/client.ts`/`lib/youtube/client.ts` don't yet distinguish an HTTP 429 from any other error, and with no cron/polling in this app there's nowhere for that state to be checked proactively anyway (same open hosting decision, spec §37.3). The other four health states (Healthy/Not Added/Reconnect Required/Error) are real, live aggregations of existing connection status columns.
