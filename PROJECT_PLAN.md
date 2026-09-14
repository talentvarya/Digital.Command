# Digital Command — Project Plan

Source of truth: `Digital_Command_Claude_Master_Build_Spec.md` (owner-supplied). This file tracks how that spec maps to build phases; it does not restate the spec.

## Phases (spec §35)

| Phase | Scope | Status |
|---|---|---|
| 1 | Branding shell, Supabase Auth, multi-tenant DB + RLS, Super Admin, client registration, policy acceptance, business verification, manual payment verification, client activation | ✅ Built |
| 2 | Client dashboard, Brand Brain, website/link setup, 7-day planner, Autopilot/Approval Required, content versions, notifications | ✅ Built |
| 3 | SEO audit, Search Console, Analytics, reporting, graphs, keyword/competitor tracking | ✅ Built |
| 4 | Buffer integration, Facebook/Instagram publishing, YouTube, GBP/Local SEO | ✅ Built — GBP deferred, see below |
| 5 | Off-page opportunity engine, outreach, digital PR, backlink verification | ✅ Built — backlink-index-class data deferred, see below |
| 6 | Paid campaign preparation, manual approval, budget/date controls, ad reporting | ✅ Built — live ad-platform launch stays manual by design, see below |
| **7** | Client AI Assistant, conversion tracking, cost dashboard, backup/rollback, API health center, emergency freeze, offboarding, sandbox | **This build — final phase in the spec, see below** |

## Phase 1 exit criteria

- A visitor can register a business, accept every mandatory policy, submit business-verification documents and a manual payment reference.
- A Super Admin can review verification documents, approve/reject/request more documents (reason mandatory for the latter two), verify or reject the payment, and activate the account — all via role-gated pages, no service-role key involved.
- Data is isolated per organization via Postgres RLS — verified by registering two test clients and confirming neither can see the other's rows.
- Every state-changing action is recorded in `audit_logs` with actor, source, before/after state.
- Super Admin login requires TOTP MFA before reaching the dashboard.
- Non-Phase-1 client dashboard modules are visibly labeled "Coming in next build phase" — never presented as working.

## Explicit non-goals for Phase 1

- No Buffer/Google/Meta/YouTube API integrations (Phase 4).
- No real KYC/Aadhaar verification API (open item — spec §37.1/§37.2); documents are reviewed by a human Super Admin.
- No email receipts (spec §20) — audit log is the authoritative record until a later phase wires up an email provider (open item §37.4).
- No paid-advertising anything (Phase 6) — not even a placeholder UI, to avoid any risk of implying auto-spend.

## Phase 2 exit criteria

- A client can fill out their Brand Brain (spec §18) and every field feeds real AI generation prompts.
- A client can add/edit/remove website & channel links and run a real reachability health check (spec §12's URL-storage half; OAuth "Connect Account" is Phase 4).
- A client can generate real AI captions (Anthropic API) for a 7-day planner slot, edit them, approve/reject/skip, regenerate up to 3 times, then must add a suggestion to regenerate again (spec §10's revision flow), or upload their own content directly.
- Autopilot mode auto-schedules AI content unless it trips the words-to-avoid policy check, in which case it's held for approval and the client is notified — a real gate, not a no-op.
- Super Admin gets read-only visibility into a client's Brand Brain and upcoming planner content (support, not editing control).
- `npm run lint` and `npm run build` stay clean.

## Explicit non-goals for Phase 2

- No actual publishing to Facebook/Instagram/YouTube — content's realistic terminal state is `scheduled`, not `published` (that's Phase 4/Buffer).
- No background cron / unattended scheduling — generation is on-demand (button click); true zero-click automation needs a hosting decision that's still open (spec §37.3).
- No AI image/video generation — planner media is manually uploaded (AI image/video gen is a separate, later, extra-priced feature per spec §15/§16).
- No email notifications — the in-app `notifications` table is the only channel so far, consistent with Phase 1's deferral of email receipts.

## Phase 3 exit criteria

- A client can run a real technical SEO audit (robots.txt, sitemap.xml, on-page checks, broken-link sample) against their own website with no external account needed, and see a 0–100 score + issue list.
- A client can connect Google Search Console and Google Analytics via real OAuth, pick their property, and sync real metrics on demand.
- Keyword tracking shows real Search Console query data with period-over-period position trend — no separate paid rank-tracker.
- A client can generate a report combining real SEO/Search-Console/Analytics/planner numbers with an AI-written narrative that never invents a metric.
- `npm run lint` and `npm run build` stay clean.

## Explicit non-goals for Phase 3

- Competitor tracking is not wired up — explicit user decision to defer rather than start a new paid Semrush/Ahrefs-style vendor relationship without sign-off (spec §36).
- Google Search Console/Analytics connections only work for Google accounts added as **Test Users** on the project's OAuth consent screen until the user completes Google's app verification process (spec open item §37.13) — a real, potentially days-to-weeks external dependency, not something this build can shortcut.
- No automatic/scheduled report generation — same on-demand, no-cron pattern as Phase 2's AI generation, for the same hosting-decision reason (spec §37.3).

## Phase 4 exit criteria

- Facebook/Instagram content that reaches `status='scheduled'` in the planner (client approval or Autopilot) is really sent to Buffer as a scheduled post, using VMG's own Buffer account/channels (see "The Buffer reality" below).
- YouTube content similarly triggers a real multipart upload to the client's own connected YouTube channel, scheduled via `publishAt`.
- An on-demand status check flips `content_items.status` to `published` for real once Buffer/YouTube confirm, or records a `publish_error` the client can see.
- Admin can link a client's org+platform to one of VMG's Buffer channels from the client detail page.
- `npm run lint` and `npm run build` stay clean.

## The Buffer reality (read before assuming "Buffer integration" means per-client OAuth)

I researched Buffer's actual current API before building this (training data on it was stale) and found the premise the master spec's §13 seems to assume — clients connecting their own Buffer accounts — isn't available: Buffer's old third-party-OAuth REST API is closed to new developer registrations, and its new GraphQL API's public beta only supports a personal API key tied to **one** Buffer login. Confirmed with the user (AskUserQuestion, twice — the second time specifically to correct my own first answer once I'd verified the facts) to proceed under the actual available model: **one shared VMG Buffer account/subscription**, with each client's channel added to it individually (on buffer.com, using the client's own Facebook login), then linked to the right org from Digital Command's admin panel. See `ARCHITECTURE.md` and `SECURITY_AND_RLS.md` for the full mechanics and why `buffer_channel_links` is admin-owned rather than client-owned like every other Phase 1–3 connection table.

## Explicit non-goals for Phase 4

- **Google Business Profile is not started.** GBP API access requires a separate formal access-request form, a Business Profile that's been verified and **active for 60+ days**, a business website, and a Google review (days to weeks, rejections common) — quota is 0 until approved, so there's no way to even test against it the way Search Console's Test-User model allowed. Revisit once the user has an eligible, 60+-day-old GBP and wants to start that process.
- No resumable-upload protocol for YouTube — multipart (single request) is simpler and correct for this server-to-server relay; very large videos may hit serverless payload/execution limits depending on the still-open hosting decision (spec §37.3).
- No AI cost cap on report generation (flagged in Phase 3, still open) or on publishing dispatch — worth adding before real client traffic.

## Phase 5 exit criteria

- A client can add a candidate URL (guest post, broken-link target, unlinked mention) and get a real AI assessment (relevance/quality/spam-risk) of the actually-fetched page, plus any contact email found on it.
- A client can search for unlinked mentions of their brand (real Google Custom Search results) and turn any result into a tracked opportunity in one click.
- A client can get a real, personalized (not templated) AI-drafted outreach email per opportunity, open it pre-filled in their own email client, and mark it sent — no bulk-send capability exists anywhere in the schema or UI.
- A client can verify (on demand) whether a specific URL still links back to their own site, and the opportunity's status reflects `link_acquired` or flips to `lost` accordingly.
- Super Admin gets a read-only opportunity-status-count summary (support visibility only).
- `npm run lint` and `npm run build` stay clean.

## Explicit non-goals for Phase 5

- **Backlink-index-class data is not wired up**: competitor backlink analysis, web-wide backlink opportunity discovery, lost-backlink monitoring beyond opportunities this app already knows about, local citation checks, and digital PR opportunity discovery all fundamentally need a paid Ahrefs/Semrush/Moz-class index. Asked the user again specifically for this phase (backlink data isn't the same as Phase 3's keyword-tracking question) — same answer: defer rather than start a new paid vendor relationship without explicit sign-off (spec §36).
- No automated email sending — outreach is drafted and tracked in Digital Command, but sending happens through the user's own email client (a `mailto:` link, pre-filled). Deliberate, not a gap: there's still no transactional email provider decision made (open since Phase 1, spec §37.4), and personalized 1:1 outreach genuinely performs better from a real inbox than a bulk sender anyway.
- "Opportunity discovery" here means *assessing a URL a human found*, not an automated web-wide crawler hunting for candidates — that discovery engine is exactly the backlink-index-shaped need that's deferred above.

## Phase 6 exit criteria

- A client can draft a paid campaign (platform, objective, goal) and get a real AI-drafted audience/keywords/creative brief plus qualitative (never authoritative) budget guidance.
- The client — never AI, never Super Admin — sets the real, binding maximum spend, budget period, and start/end dates, and must explicitly submit for approval, then tick a confirmation checkbox stating what's being authorized before a campaign can become `approved`. This is enforced at the RLS layer, not just in the UI (see `SECURITY_AND_RLS.md`).
- Every approval/rejection decision is recorded as its own immutable row (`paid_campaign_approvals`) with an incrementing `approval_version`, the exact budget/dates it covered, who decided, and their IP/user-agent — editing an approved or rejected campaign automatically resubmits it for a fresh decision, so an approval is only ever valid for what it actually covered.
- Super Admin can mark an `approved` campaign `launched_externally` (recording the real ad platform's campaign ID) only after the client has approved it, and can update platform status/spend/clicks/conversions from what they see in the ad platform's own dashboard — but can never set a campaign to `draft`/`pending_approval`/`approved`/`rejected` themselves, preserving the client-approves-spend rule even against a well-meaning admin mistake.
- **At no point does Digital Command's own code call a live Google Ads or Meta Marketing API, or spend any money.** "Launch" is always a manual, external, human action performed directly on the ad platform.
- `npm run lint` and `npm run build` stay clean.

## Explicit non-goals for Phase 6

- **No live Google Ads/Meta Marketing API integration.** Researched both platforms' current access requirements before scoping this phase: Google Ads API Basic Access can now be approved in hours with brand verification, but Meta's Marketing API requires Business Verification + App Review specifically because Digital Command would be managing *other businesses'* ad accounts, not just VMG's own — neither is instant, and a bug in either integration has a real financial consequence, not just a UX one. Asked the user how far to go given that; the answer was to build the full prepare + approve + audit workflow for real, but keep the actual "make it live" step a manual handoff to VMG staff working directly in each platform's own dashboard. Revisit if/when the user wants to pursue real ad-platform API access.
- No automatic campaign optimization, bid management, or A/B testing — out of scope for a "prepare + approve + audit" system of record.
- No scheduled/automatic performance sync — spend/clicks/conversions are manually entered by Super Admin from what they see in the ad platform's own dashboard (same on-demand, no-cron discipline as every sync in this app, and there's no live API connection to sync from yet anyway).
- No AI cost cap on campaign drafting yet — same open item already flagged for report-narrative generation (Phase 3), publish-dispatch (Phase 4), and opportunity-assessment/outreach-drafting (Phase 5); see `SECURITY_AND_RLS.md`.

## Phase 7 exit criteria — the final phase in the spec

- A client can chat with an in-app AI assistant that can explain their report/SEO trend, edit or regenerate a scheduled post, skip a day, or draft new content — using an explicit, small set of tools that structurally cannot approve paid spend, touch security settings, or do anything bulk. Every mutating tool call is attributed `SOURCE = GPT_ASSISTANT` — the first real use of that audit enum value since it was defined in Phase 1. Anything the assistant changes always still needs the client's own approval, even under Autopilot.
- A client can create trackable WhatsApp/call/form/booking links, place them on their own website, and see real click/lead/sale/booking counts alongside real Search Console/Analytics numbers in one funnel view — genuinely realizing the spec's own example funnel, not a mockup.
- A client can browse an already-scheduled post's full edit history and restore any previous version — using the append-only `content_versions` table that's existed since Phase 2 but never had browse/restore UI until now.
- A client can pause their own account's automation (Master STOP) without losing any data; Super Admin can freeze the entire platform's publishing/uploads/outreach/AI jobs in an emergency while keeping login/reports/audit logs available — both wired to real, previously-dead schema columns/policies (see "Two pre-existing bugs" below).
- A client and Super Admin can each see one place (`/app/health`, and a read-only section on the admin client page) showing every connection's real status, aggregated from data that already existed.
- Super Admin can offboard a client — real Google token revocation, real Buffer-link removal, real cancellation of not-yet-sent content, a real data export — without deleting anything, and mark the account closed.
- Super Admin can see real per-client AI cost (auto-tracked from actual Claude API token usage) alongside revenue and manually-entered Buffer/storage/other costs, with a clear flag on anything at or below breakeven. No client can see this page.
- Super Admin can mark an org as a sandbox/test account, visible everywhere that org appears in the admin UI.
- `npm run lint` and `npm run build` stay clean.

## Two pre-existing bugs Phase 7's own work surfaced (fixed as part of this build, not new features)

1. `client_settings.master_stop` has defaulted to `true` since Phase 1's schema — meaning "stopped" — and was never read or written by any code. Wiring Master STOP to actually gate automation without fixing this would have silently stopped every existing and newly-activated client's automation on day one. Fixed: default flipped to `false`, existing rows backfilled, in `0016_phase7_schema.sql`.
2. `setControlModeAction` (Phase 2's Autopilot/Approval-Required toggle) has been updating `client_settings` under an org-member session since it was written, but the table's only UPDATE policy was Super-Admin-only (`0002_rls.sql`) — meaning **this toggle has been silently updating zero rows for any real client since Phase 2**, undetected because there's been no live Supabase project to test against yet. Fixed with a new org-member UPDATE policy in `0017_phase7_rls.sql`, needed anyway for the new Master STOP toggle.

## Explicit non-goals for Phase 7

- **No real data deletion/purge on offboarding.** The spec names no retention period for §29's "start retention/deletion process," and guessing one would be a real legal-shaped risk, not just a bug — explicit, informed user decision. Offboarding revokes/disconnects/exports/marks-closed for real; nothing is ever deleted.
- **No live Rate-Limited detection in the Connection Health Center.** `lib/buffer/client.ts`/`lib/youtube/client.ts` don't distinguish an HTTP 429 from any other error yet, and with no cron/polling infrastructure in this app (still blocked on the open hosting decision, spec §37.3) there's nowhere to check it proactively anyway. The other four health states are real, live aggregations of data that already existed — this one is honestly deferred, not faked.
- No automated backoff/retry-threshold logic for API calls generally — same reasoning as above.
- No AI cost cap on assistant conversations yet — same open item already flagged for every other AI call site since Phase 3.
- The assistant is the in-app option from §17's two named choices ("in-app AI assistant OR premium managed AI workspace") — not a new vendor decision, so nothing to ask sign-off for; the "premium" gating mechanism itself (who gets access, at what price) isn't implemented since the spec doesn't define one and no plan field exists to hang it on.
- USD→INR conversion on the Cost Dashboard uses a fixed, approximate exchange rate constant (`lib/constants/currency.ts`) rather than a live rate — re-check periodically, same discipline as the Haiku pricing constants.

This is the last phase defined in the master build specification (§35). Everything from here is either a deferred item already tracked in this document (competitor tracking, backlink-index data, Google Business Profile, live ad-platform APIs, real KYC, transactional email, unattended cron) or genuinely new scope the owner decides to add.

## Live database verification (post-Phase 7)

The single biggest untested surface across all 7 phases was that none of them had ever run against a real, live Supabase project with RLS actually enforced — every prior phase's "verification" was `npm run lint`/`npm run build` plus a browser check that unauthenticated visitors get redirected, which never exercises an authenticated INSERT/UPDATE under real RLS. Once a real project was connected, all 17 original migrations (`0001`–`0017`) applied cleanly on the first attempt, including every constraint-rename and the Phase 7 singleton-table/trigger/anon-grant patterns that could only be reasoned about, not tested, until now.

A full registration → verification → payment submission walkthrough (real signup, real email confirmation via a disposable inbox, real document/payment uploads) then surfaced a real, previously-invisible bug: `organizations_select`'s RLS policy blocked a user from seeing the org row they had just created (no `organization_members` row exists yet at that exact moment), which broke `completeRegistrationAction`'s `INSERT ... RETURNING` and meant **registration could never actually complete against a real Supabase project**, for anyone, since Phase 1. Fixed in `0018_fix_org_select_on_create.sql` — full diagnosis and reasoning in `SECURITY_AND_RLS.md`. Re-ran the full registration flow after the fix; it now completes correctly end-to-end (org created, ownership membership recorded, verification submitted with both documents, payment recorded, all 10 mandatory consents recorded).

This is the third real bug found this way, after the two `client_settings` RLS/default issues Phase 7's own work surfaced (see above) — all three share the same root cause (a policy or default that was never exercised against real infrastructure) and the same lesson: this class of bug is structurally invisible to `build`/`lint`/route-guard checks and only surfaces under genuine RLS enforcement, which is exactly why this verification pass was worth doing before any real client registers.

Continued verification (same pass) confirmed, live and end-to-end, using the account this registration created: Master STOP (blocked an SEO audit attempt, then allowed it once lifted), Emergency Freeze (blocked the same action platform-wide, independent of Master STOP), and conversion tracking's public `/api/track/[linkId]` redirect — a genuinely anonymous, no-session request correctly exercised the new anon column-grant + INSERT policy + `org_id`-deriving trigger from `0017_phase7_rls.sql`/`0016_phase7_schema.sql`, and the resulting click showed up in the real funnel view.

Running the real SEO audit against a large real-world site (not just placeholder pages) surfaced a **fourth bug**, this one application logic rather than RLS: `runSeoAudit()` checked `robots.txt`/`sitemap.xml` relative to whatever *path* the client entered (e.g. `https://example.com/en`) instead of the site's origin root, where these files are required to live by spec — so any client whose URL included a path got incorrect "not found" findings and an unfairly lowered score for files that actually existed. Fixed by resolving both checks against `new URL(normalizedBase).origin` instead of the full path; on-page checks (title/meta/h1/images/internal links) correctly continue to use the full entered path. Re-verified against the same real site after the fix — score corrected and the false findings disappeared.

Two-tenant isolation is the one thing this pass has **not** yet verified — blocked by Supabase's default auth email rate limit on new signups. The RLS policies themselves were all individually re-read and confirmed to use the same simple, auditable `is_org_member(org_id)` scoping throughout, but that's code review, not the same as an empirical two-account test — worth doing once the rate limit clears or a second real signup is available.

## Kimi, Gemini, and OpenAI as additional AI providers (post-Phase 7) — why the AI Assistant stays Claude-only

Kimi added first, at the user's explicit request once they had a real Moonshot AI API key — confirmed twice that this is **additive**: alongside Claude, not replacing it. Gemini and OpenAI followed the same request in the same sitting, once the Kimi pattern was already proven. Claude remains the default throughout, unchanged from the master spec's original Anthropic decision.

One deliberate scope cut, applying equally to all three additions: the **AI Assistant does not get a non-Claude option**. Its tool-use loop (`runAssistantChat`, `lib/ai/assistant-chat.ts`) is built directly on Anthropic's `ToolUseBlock`/`tool_result` content-block shape, which has no structural equivalent in any of the other three providers' own tool-calling conventions (Kimi and OpenAI each use their own, mutually different, OpenAI-style `tool_calls` shapes; Gemini uses a distinct `functionCall`/`functionResponse` convention) — porting it would mean maintaining four separate state machines for one feature, real scope beyond what was asked for here. The assistant's `regenerate_content` tool (its one indirect path into the shared caption-generation code) is explicitly pinned to `{provider: "anthropic"}` regardless of the global `AI_PROVIDER` setting, specifically so this stays true no matter which provider the rest of the app is switched to — otherwise a single assistant turn could blend another provider's token usage into an Anthropic-priced cost log, which can't be attributed correctly. Full technical detail in `ARCHITECTURE.md`'s "AI Provider Abstraction" section; live-verification status in `BUILD_PROGRESS.md`.

Also carried over from the Kimi decision, unchanged for Gemini/OpenAI: `AI_PROVIDER` stays **one global switch for the whole deployment**, not a per-org/per-client selector — nobody asked for that, and a settings surface for choosing among 4 providers per client would be new scope this build wasn't asked to take on.
