# Digital Command — Architecture (Phase 1 + 2 + 3 + 4 + 5 + 6)

## Stack

- **Next.js 14 (App Router) + TypeScript** — server components for data fetching, server actions for all mutations.
- **Supabase**: Postgres + Auth + Storage, accessed via `@supabase/ssr`. RLS is the authorization layer — the app almost never needs the service-role key (see `SECURITY_AND_RLS.md`).
- **TailwindCSS** for styling, `lucide-react` for icons, `zod` for input validation at the server-action boundary.
- **`@anthropic-ai/sdk`** (Phase 2+) — server-only, generates 7-Day Planner captions, report narratives (Phase 3), (Phase 5) off-page opportunity assessments + outreach drafts, and (Phase 6) paid campaign briefs (`claude-haiku-4-5-20251001`). See "AI content generation", "Reporting", "Off-page opportunities", and "Paid campaign preparation" below.
- **`cheerio`** (Phase 3+) — server-only HTML parsing, shared by the SEO crawl audit and (Phase 5) off-page page-fetching (`lib/web/fetch-page.ts`).
- **Google OAuth (plain `fetch`, no `googleapis` SDK)** (Phase 3+) — Search Console, Analytics Data API, and (Phase 4) YouTube Data API access. A handful of REST calls didn't justify the heavy official SDK.
- **Buffer GraphQL API (plain `fetch`)** (Phase 4) — Facebook/Instagram publishing, one shared personal API key (see "Publishing dispatch" below for why this is a different model than every other Phase 1–3 connection).
- **Google Custom Search JSON API (plain `fetch`)** (Phase 5) — brand-mention search, simple API-key auth (no OAuth), app-wide credential, free tier.

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
/app/outreach              Off-page opportunities, brand-mention search, AI-drafted outreach, backlink checks (spec §9.2)
/app/paid-campaigns        Paid campaign drafting, client budget/date authorization, approve/reject (spec §14)
/api/auth/callback         Exchanges Supabase Auth email-link codes for a session
/api/google/oauth/start    Begins the Search Console / Analytics / YouTube OAuth flow (sets CSRF state cookie)
/api/google/oauth/callback Verifies state, exchanges code for tokens, stores the connection
```

Admin panel: `/admin/clients/[orgId]` gained a "Publishing Channels" section (Phase 4) for linking a client's org+platform to one of VMG's own Buffer channels — see "Publishing dispatch" below — a read-only "Off-Page Activity" opportunity-count summary (Phase 5), and a "Paid Campaigns" section (Phase 6) with the admin's only two write actions: Mark Launched and Update Status/Performance — see "Paid campaign preparation + approval" below.

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

## Publishing dispatch (Phase 4, `lib/publishing/dispatch.ts`) — the Social Publishing Adapter seam, now real

Documented since Phase 1 as a seam ("Digital Command stays the brain; Buffer or direct APIs are pluggable backends"); Phase 4 is where it gets an actual implementation.

**Before building this I verified Buffer's real 2026 API** (my training data on it was stale) rather than assuming the master spec's §13 model of "clients connect their own Buffer account." That model isn't available: Buffer's old third-party-OAuth REST API is closed to new developer registrations, and its new GraphQL API's public beta supports only a **personal API key tied to one Buffer login** — not OAuth for onboarding many separate client accounts. Confirmed with the user (twice — the second round specifically to correct my own first answer once I'd checked the facts) to proceed under the real model: **one shared VMG Buffer account**, each client's Facebook Page/Instagram account added as a *channel* to it via Buffer's own site (client authorizes through Facebook's login when VMG's admin adds the channel — outside Digital Command), Digital Command posts through VMG's single `BUFFER_ACCESS_TOKEN` server-side, keyed by `buffer_channel_id` per org+platform (`buffer_channel_links`, **admin-managed** — a different ownership model than every other Phase 1–3 connection table, which are all client-managed; see `SECURITY_AND_RLS.md`).

```
dispatchToPublisher(supabase, contentItem) — called whenever a content_item reaches
status='scheduled' (decideContentAction's approve path, generateAiContentAction's
Autopilot auto-schedule path, createManualContentAction's immediate-schedule path —
all three in app/app/planner/actions.ts). Never throws; a missing connection just
leaves publish_status='not_sent', which is a normal, expected state.

  facebook/instagram:
    look up buffer_channel_links(org_id, platform)
      found -> lib/buffer/client.ts createBufferPost()
                 - dueAt from scheduled_date/time
                 - assets: content_media rows -> 7-day signed URLs (Buffer downloads
                   the file itself; it needs a publicly fetchable URL, not bytes)
                 - text: caption + hashtags
               -> store buffer_post_id, publish_status='sent'
      not found -> leave publish_status='not_sent' (unconfigured, not an error)

  youtube:
    look up google_connections(org_id, 'youtube') via getValidAccessToken()
      connected -> lib/youtube/client.ts uploadYoutubeVideo()
                     - downloads the video from Supabase Storage server-side
                     - multipart upload (JSON metadata + video bytes, one request)
                       to YouTube Data API v3, status.privacyStatus='private' +
                       status.publishAt=<scheduled time> (YouTube auto-flips to
                       public at that time — same "schedule for later" shape as
                       Buffer's dueAt)
                   -> store youtube_video_id, publish_status='sent'
      not connected -> leave publish_status='not_sent'
```

**Status confirmation** (`checkPublishStatusAction`, on-demand — same no-cron discipline as every sync in this app): for items with `publish_status='sent'`, re-queries Buffer's `post` status / YouTube's `videos.list` status; flips `content_items.status` to `published` (reachable for real as of Phase 4 — previously an unreachable enum value) on confirmation, or sets `publish_status='error'` + `publish_error` on failure, both surfaced in `ContentItemCard`.

Spec §25's generic `api_connections` table now has two real, differently-shaped instances rather than one speculative catch-all: `google_connections` (per-org OAuth, client-managed) and `buffer_channel_links` (one shared account's channels, admin-managed) — confirms the Phase 3 prediction that a single `api_connections` table wouldn't fit every provider's credential shape. `api_health_events` (spec §27's Connection Health Center) is still **not created** — each connection table's own `status` column covers today's need.

## Off-page opportunities (Phase 5)

Like Phase 4's Buffer decision, this needed a real check before building: most of spec §9.2's bullets (competitor backlink analysis, web-wide opportunity discovery, lost-backlink monitoring, local citations, digital PR) fundamentally need a paid backlink/SEO-data index — asked the user again specifically for this phase (backlink data isn't the same question as Phase 3's keyword tracking), same answer as before: defer rather than start a new paid vendor relationship. So this is scoped around what's real without one — see `PROJECT_PLAN.md`'s Phase 5 section for the full reasoning.

```
lib/web/fetch-page.ts — fetchPageContent(url), shared with the Phase 3 SEO audit
  (extracted so the fetch+cheerio pattern isn't duplicated): title, visible text,
  mailto: emails, a detected contact-page URL. Also pageLinksToDomain(html, pageUrl,
  targetDomain) for backlink verification.

addOpportunityAction (app/app/outreach/actions.ts)
  -> fetchPageContent(url) -> assessOpportunity() (lib/ai/assess-opportunity.ts)
       -> Claude judges relevance/quality/spam-risk from the ACTUAL fetched text,
          instructed to never invent facts about the site
  -> insert off_page_opportunities (status='assessed', or 'new' if the fetch failed —
     still saved, never silently dropped)

searchBrandMentionsAction -> lib/google/custom-search.ts searchBrandMentions(query)
  -> insert brand_mention_searches (append-only snapshot, same pattern as Phase 3's
     *_snapshots). Each result has a "Turn into Opportunity" button that's just
     addOpportunityAction with opportunity_type='unlinked_mention' — same pipeline.

draftOutreachAction -> draftOutreachMessage() (lib/ai/draft-outreach.ts) — one-at-a-time,
  context-aware draft using the target page's real content + Brand Brain voice
  -> insert outreach_messages (status='draft')
  UI renders a mailto: link (contact email + subject + body, pre-filled) — sending
  happens in the user's own email client. markOutreachSentAction just records that
  and sets a 7-day follow_up_due_at + advances the opportunity's status
  (contacted -> awaiting_response on a follow-up).

checkBacklinkAction -> re-fetches the opportunity's own URL, pageLinksToDomain()
  against the org's own website (from org_links) -> status flips to 'link_acquired'
  (first time) or 'lost' (was verified, now isn't) -> this IS real "earned backlink
  verification" / "lost backlink monitoring" (spec §9.2), scoped to links Digital
  Command knows about through this pipeline rather than the open web.
```

**No bulk-send capability exists anywhere in this schema or UI** — every outreach message is drafted and reviewed one opportunity at a time. This isn't a missing feature; it's what keeps Phase 5 structurally compliant with spec §33/§36's "no mass spam, no auto forum/comment spam" rule without relying on a policy nobody enforces.

## Paid campaign preparation + approval (Phase 6)

The highest-stakes phase in the spec — master prompt rule #6 and spec §14/§36 all say, repeatedly, that paid ad spend must never start automatically. Before scoping this I checked both ad platforms' current API access reality: Google Ads API Basic Access can now be approved in hours with brand verification, but Meta's Marketing API needs Business Verification + App Review specifically because Digital Command would manage *other businesses'* ad accounts, not just VMG's own. Asked the user how far to go given that a bug in either integration has a real financial consequence; the answer was to build the full prepare + approve + audit workflow for real, but keep "make it live" a manual, external, human action — mirroring the same pattern Phase 4 used for Buffer channel-connecting (some steps genuinely belong outside this app). **No Google Ads/Meta API calls exist anywhere in this codebase.**

```
prepareCampaignAction (app/app/paid-campaigns/actions.ts)
  -> prepareCampaignDraft() (lib/ai/prepare-campaign.ts) — audience/keywords/creative brief,
     plus suggestedBudgetNotes explicitly prompted to be QUALITATIVE guidance only, never a
     number presented as authoritative — the one AI output in this app adjacent to real money
  -> insert paid_campaigns (status='draft')

updateCampaignAction — client edits audience/keywords/creative AND the real authorization
  fields (max_spend, budget_period, start_date, end_date — always client-set, never AI-set).
  Editing a campaign that's already 'approved' or 'rejected' resets it to 'pending_approval':
  an approval is only ever valid for the exact parameters it covered.

submitForApprovalAction: draft -> pending_approval (a deliberate, explicit step — even
  though the same person usually drafts and approves, formally submitting is what spec
  §14's approval record is proving happened)

approveCampaignAction — the single most safety-critical action in this app:
  -> requires status='pending_approval' AND max_spend/budget_period/start_date/end_date
     already set AND an explicit confirmation checkbox
  -> insert paid_campaign_approvals (decision='approved', approval_version, a full snapshot
     of the budget/dates being authorized, approved_by, ip_address, user_agent — spec §14's
     exact field list)
  -> update paid_campaigns.status = 'approved'
  Only an org member can call this — paid_campaigns_update_admin (RLS) has no path to
  'approved', and this action is the only code path that ever writes that status. See
  SECURITY_AND_RLS.md.

rejectCampaignAction — same shape, decision='rejected', reason required.

Super Admin (app/admin/clients/[orgId]/paid-campaign-actions.ts) — after launching the
campaign directly in Google Ads/Meta's own dashboard:
  markCampaignLaunchedAction: requires status='approved' -> status='launched_externally'
    + external_campaign_id (what VMG created on the ad platform) + launched_by/launched_at
  updateCampaignPerformanceAction: manually-entered platform status/spend/clicks/conversions
    from what VMG sees in the ad platform's own dashboard (no live API pull exists yet) ->
    status can only move within {launched_externally, paused, completed, cancelled}
    (ADMIN_SETTABLE_STATUSES, lib/constants/paid-campaigns.ts) — enforced in the action
    itself, since RLS's admin UPDATE policy is broad and doesn't structurally stop an admin
    from writing 'approved'. This allowlist check is the actual enforcement point for
    "admin can never authorize spend" on the admin side.
```

## Directory structure

```
app/                    Route segments (pages + colocated server actions)
components/             Shared UI; admin/, client/, registration/, brand/, links/, planner/, seo/, reports/,
                        publishing/, outreach/ subfolders
lib/
  supabase/             Browser/server/middleware Supabase clients + storage upload helper
  audit/                logAudit() helper used by every mutating action
  auth/                 getPostLoginRedirect(), requireSuperAdmin(), requireOrgMember()
  ai/                   client.ts (shared Anthropic client/model), generate-content.ts (captions),
                        generate-report.ts (report narratives), assess-opportunity.ts,
                        draft-outreach.ts (Phase 5), prepare-campaign.ts (Phase 6) — Phase 2/3/5/6
  google/               oauth.ts (auth URL, token exchange/refresh), search-console.ts, analytics.ts,
                        custom-search.ts (Phase 5, simple API key, no OAuth) — Phase 3+
  youtube/               client.ts — upload/status via YouTube Data API v3 — Phase 4
  buffer/                client.ts — Buffer GraphQL API wrapper — Phase 4
  publishing/            dispatch.ts — the Social Publishing Adapter's real implementation — Phase 4
  seo/                  audit.ts — the crawl-based technical SEO checker — Phase 3
  web/                   fetch-page.ts — shared crawl helper (SEO audit + off-page assessment) — Phase 5
  constants/            Business-type doc requirements, plan pricing, required policy list,
                        platform/link-type labels, revision-flow threshold, Google service labels,
                        ad-platform/budget-period labels + admin-settable statuses (Phase 6)
  validation/           zod schemas for registration input
  utils/                Request IP/user-agent extraction for audit logs
types/database.ts       Hand-written types mirroring the SQL schema (no live project yet to codegen from)
supabase/migrations/    SQL migrations, run in order (see supabase/README.md)
```
