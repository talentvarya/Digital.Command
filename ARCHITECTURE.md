# Digital Command — Architecture (Phase 1 + 2 + 3)

## Stack

- **Next.js 14 (App Router) + TypeScript** — server components for data fetching, server actions for all mutations.
- **Supabase**: Postgres + Auth + Storage, accessed via `@supabase/ssr`. RLS is the authorization layer — the app almost never needs the service-role key (see `SECURITY_AND_RLS.md`).
- **TailwindCSS** for styling, `lucide-react` for icons, `zod` for input validation at the server-action boundary.
- **`@anthropic-ai/sdk`** (Phase 2+) — server-only, generates 7-Day Planner captions and (Phase 3) report narratives (`claude-haiku-4-5-20251001`). See "AI content generation" and "Reporting" below.
- **`cheerio`** (Phase 3) — server-only HTML parsing for the technical SEO crawl audit.
- **Google OAuth (plain `fetch`, no `googleapis` SDK)** (Phase 3) — Search Console + Analytics Data API access. A handful of REST calls didn't justify the heavy official SDK.

## Route map

```
/                          Public marketing/landing page
/login /forgot-password /reset-password
/register                  Step 1: account creation (email/password)
/register/check-email      Shown if Supabase requires email confirmation
/register/details          Step 2: business type, package, documents, payment, consent
/pending                   Client-facing status tracker (pre-activation)
/admin/mfa-setup           Forced TOTP enrollment for Super Admin
/admin/dashboard           Stat cards + client table
/admin/clients/[orgId]     Verification/payment review, activation, audit trail
/app/dashboard             Post-activation client dashboard
/app/brand                 Brand Brain form (spec §18) — feeds every AI generation prompt
/app/links                 Website & channel link registry + reachability health check (spec §12)
/app/planner               7-Day Content Planner — AI generation, approval workflow, manual uploads (spec §10/§11)
/app/seo                   Technical SEO audit + Search Console/Analytics connections + keyword tracking (spec §9.1)
/app/reports               On-demand reports: real metrics + AI-written narrative (spec §21)
/api/auth/callback         Exchanges Supabase Auth email-link codes for a session
/api/google/oauth/start    Begins the Search Console / Analytics OAuth flow (sets CSRF state cookie)
/api/google/oauth/callback Verifies state, exchanges code for tokens, stores the connection
```

`middleware.ts` (via `lib/supabase/middleware.ts`) refreshes the Supabase session on every request and enforces route guards: auth required for `/admin`, `/app`, `/pending`, `/register/details`; role check + MFA check for `/admin/*`; org-membership + `status === 'active'` check for `/app/*` (which is why `/app/brand`, `/app/links`, `/app/planner` are unreachable until Super Admin activation — same guard, no extra wiring needed).

## Data flow for the registration → activation lifecycle

```
/register (signUpAction)
  -> supabase.auth.signUp()
  -> if session returned: /register/details
     else (email confirmation required): /register/check-email -> /login -> getPostLoginRedirect -> /register/details

/register/details (completeRegistrationAction, one server action, one request)
  -> insert organizations (status=draft)
  -> insert organization_members (owner)
  -> insert subscriptions (status=pending)
  -> insert business_verifications (status=draft) + upload docs to Storage + verification_documents rows
  -> update business_verifications.status = submitted
  -> update organizations.status = pending_approval
  -> insert payments (status=pending_verification) [+ screenshot upload]
  -> insert consent_records (one per required policy_versions row)
  -> logAudit('registration_submitted')
  -> redirect /pending

Super Admin (/admin/clients/[orgId] actions)
  -> reviewVerificationAction: business_verifications.status = approved | rejected | more_documents_required
  -> reviewPaymentAction: payments.status = verified | rejected
  -> activateOrgAction (only enabled when verification=approved AND payment=verified): organizations.status = active
       -> DB trigger handle_org_activation(): creates client_settings, activates + dates the subscription
  -> rejectApplicationAction: organizations.status = rejected (terminal)
  -> every action calls logAudit(...)
```

All of the above run under the **calling user's own authenticated session** — RLS policies (not application code) are what actually prevent a client from, say, approving their own verification. See `SECURITY_AND_RLS.md`.

## AI content generation (Phase 2, `lib/ai/generate-content.ts`)

```
generateAiContentAction (app/app/planner/actions.ts)
  -> fetch brand_profiles + client_settings.content_control_mode for the org
  -> generateCaption({ platform, brandProfile, previousCaptions, clientSuggestion })
       -> @anthropic-ai/sdk, model claude-haiku-4-5-20251001, system prompt built from
          Brand Brain fields, strict-JSON response parsed with a plain-text fallback
  -> findAvoidedWords(caption, brand.words_to_avoid) — the real "Quality/Policy check" (spec §10)
  -> status = autopilot && no avoided words  ? 'scheduled'
            : 'waiting_approval'                (approval_required, OR autopilot held for policy)
  -> insert/update content_items + append a content_versions row
  -> if held-for-policy under Autopilot: insert a notification explaining why
```

Regeneration ("Generate Another") reuses the same action with an existing `contentItemId`, incrementing `content_items.rejection_count` each time. Once that count reaches `REJECTIONS_BEFORE_SUGGESTION` (3, `lib/constants/content.ts`), the action refuses to regenerate without a `clientSuggestion` — implementing spec §10's "3 rejected options → ask for suggestion → generate from suggestion → Approve or Skip" flow. The UI (`ContentItemCard`) hides further regeneration once a suggestion-based round has been used.

Client-uploaded content (`createManualContentAction`) skips this pipeline entirely — source `client_uploaded`, status goes straight to `scheduled`, since it's the client's own work being reviewed by no one but themselves (spec §11: adding your own content to a slot means Autopilot shouldn't also generate for it — trivially true here since the slot's only item is created immediately).

A monthly per-org safety cap (`MONTHLY_AI_GENERATION_SAFETY_CAP`, `lib/constants/content.ts`, checked at the top of `generateAiContentAction`) exists purely to bound cost — not a package entitlement, tunable once real usage data exists (spec §30/§36).

## SEO audit + Google connections + Reporting (Phase 3)

```
Technical SEO audit — no external account needed
  runAuditAction (app/app/seo/actions.ts)
    -> lib/seo/audit.ts: runSeoAudit(url)
         -> fetch robots.txt / sitemap.xml / homepage HTML (cheerio) / ~10 internal links
         -> weighted 0-100 score + an issues[] list, every finding traced to something actually fetched
    -> insert seo_audits row

Google Search Console / Analytics — needs the user's own Google Cloud OAuth app
  GET /api/google/oauth/start?service=search_console|analytics
    -> auth required, sets httpOnly `google_oauth_state` cookie (CSRF), redirects to Google
  GET /api/google/oauth/callback
    -> verifies state === cookie, exchangeCodeForTokens(), upserts google_connections
       (preserves the existing refresh_token if Google doesn't re-issue one), redirects to /app/seo
  Property picker (rendered directly in the /app/seo Server Component once status='connected'
  and external_property is still null): listSearchConsoleSites() / listAnalyticsProperties()
    -> selectGooglePropertyAction stores the choice

  "Sync Now" (on-demand, no cron — same pattern as Phase 2's AI generation)
    -> getValidAccessToken(supabase, orgId, service) — refreshes via refresh_token if the
       access token is within 60s of expiring, persists the new token
    -> fetchSearchConsoleSnapshot() / fetchAnalyticsSnapshot() -> insert a new *_snapshots row
       (each sync is a new row, never an update — snapshot history is what makes keyword
       tracking's position deltas and the report's period-over-period comparisons possible)

Keyword tracking = the two most recent search_console_snapshots' top_queries, matched by
query text, diffed for a ▲/▼ position trend. No separate rank-tracking API.

Reports (on-demand "Generate Report")
  generateReportAction (app/app/reports/actions.ts)
    -> gathers the latest 2 seo_audits, search_console_snapshots, analytics_snapshots
       (for deltas) + content_items counts in the period (a Phase 2 planner cross-reference)
    -> generateReportNarrative() (lib/ai/generate-report.ts) — same Anthropic wrapper as the
       planner, system-prompted to use ONLY the numbers given, never invent a metric or
       promise a guaranteed result
    -> insert reports row (raw metrics_snapshot jsonb + the AI summary/next-plan text)
```

**Token handling**: `google_connections.access_token`/`refresh_token` are read/refreshed exclusively inside server actions and route handlers (`lib/google/oauth.ts`). Every query used to *render* a connection's status explicitly selects only safe columns (`id, service, external_property, status, last_synced_at`) — see `SECURITY_AND_RLS.md`.

**Google app verification (spec open item §37.13)**: the OAuth scopes here (`webmasters.readonly`, `analytics.readonly`) are "sensitive" — until the user's Google Cloud OAuth app passes Google's verification review, only Google accounts explicitly added as Test Users on the OAuth consent screen can complete a connection. This is a real external timeline, not something this codebase can shortcut.

## Modularity seam for future integrations (spec §13/§39)

Nothing in Phase 1 talks to Buffer, Google, Meta, or YouTube yet, but the schema and route structure already assume a **publishing-adapter** shape for Phase 4+:

```
Digital Command (planner, approvals, audit, Brand Brain)
        -> Social Publishing Adapter (interface, not yet implemented)
                -> Buffer   OR   Direct Platform APIs
```

Spec §25's generic `api_connections` table arrived in Phase 3 scoped specifically to what exists (`google_connections`, `service` enum of just `search_console`/`analytics`) rather than a speculative one-size-fits-all table — it'll likely need reshaping when Phase 4 adds Buffer/Meta/YouTube connections with a different credential shape (API keys vs. OAuth vs. long-lived tokens). `api_health_events` (spec §27's Connection Health Center) is still **not created** — `google_connections.status` covers today's need; a dedicated events/incident table is a later-phase addition once there's more than one connection type to monitor.

## Directory structure

```
app/                    Route segments (pages + colocated server actions)
components/             Shared UI; admin/, client/, registration/, brand/, links/, planner/, seo/, reports/ subfolders
lib/
  supabase/             Browser/server/middleware Supabase clients + storage upload helper
  audit/                logAudit() helper used by every mutating action
  auth/                 getPostLoginRedirect(), requireSuperAdmin(), requireOrgMember()
  ai/                   client.ts (shared Anthropic client/model), generate-content.ts (captions),
                        generate-report.ts (report narratives) — Phase 2/3
  google/               oauth.ts (auth URL, token exchange/refresh), search-console.ts, analytics.ts — Phase 3
  seo/                  audit.ts — the crawl-based technical SEO checker — Phase 3
  constants/            Business-type doc requirements, plan pricing, required policy list,
                        platform/link-type labels, revision-flow threshold, Google service labels
  validation/           zod schemas for registration input
  utils/                Request IP/user-agent extraction for audit logs
types/database.ts       Hand-written types mirroring the SQL schema (no live project yet to codegen from)
supabase/migrations/    SQL migrations, run in order (see supabase/README.md)
```
