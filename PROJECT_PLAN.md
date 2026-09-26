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

## Phase 8 — Reputation Management (post-spec, first of the "best of best" roadmap)

Not in the original master spec's 7 phases — added after researching what GoHighLevel/BrightLocal/HubSpot bundle in 2026 and picking the single highest-leverage gap: reviews are the #1 thing a local-business owner already asks an agency for (see the Value Map / Fayda Map artifacts from this planning pass).

**Exit criteria met:**
- A client can save their own Google review link and Facebook review page link.
- A client can log a review request (name, phone/email, channel) — Digital Command builds the pre-filled WhatsApp/SMS/email message and opens it in the client's own app; nothing is sent by the platform itself.
- A client can log a review they received (platform, rating, reviewer, text) and get an AI-drafted reply, which they copy and post themselves, then mark posted.
- `npm run lint` and `npm run build` stay clean.

**Explicit non-goal, and why:** no automated review pulling or automated posting. Real Google review data/posting needs Google Business Profile API access — a 60+ day verified profile, a formal access request, and rejections are common — the exact same external gate that's already blocked Local SEO/GBP since Phase 4 (see that section above). Rather than wait on that gate to start anything, this phase is scoped to what's genuinely buildable today: request tracking + manual review logging + AI-drafted replies, all sent/posted through the client's own accounts — the identical "draft here, send yourself" discipline Phase 5's outreach already established. Revisit real GBP-integrated posting once that access clears.

Schema: `supabase/migrations/0022_phase8_reputation_schema.sql` + `0023_phase8_reputation_rls.sql` (applied to the live project).

## Phase 9 — Public Roadmap Lead Magnet (VMG's own sales tool, not a client-facing product feature)

A free, public, unauthenticated page at `/roadmap` (linked from the homepage) — a visitor fills in their business details, an AI generates a personalized 90-day growth roadmap on the spot (current-gaps bullets, 4 phases, an aspirational "vision" section, one urgency line), and their contact info + answers are saved as a sales lead for VMG's own Super Admin to follow up on from a new `/admin/leads` page. This has nothing to do with any client org — it's VMG's own top-of-funnel CRM, sitting entirely outside the authenticated client/admin product.

**Exit criteria met:**
- A visitor with no account can fill the form and get a real AI-generated roadmap immediately, no login/payment anywhere in the flow.
- The roadmap never promises a guaranteed outcome/number/ranking — same "aspirational, not guaranteed" discipline as every other AI-generation call site (`generate-report.ts`, `draft-outreach.ts`).
- Every submission is saved with full contact info + answers + the generated roadmap; Super Admin can view, and set status (new/contacted/converted/not_interested) with notes, from `/admin/leads`.
- A daily generation cap (`DAILY_ROADMAP_CAP` in `app/roadmap/actions.ts`) and a honeypot field guard against cost/spam abuse on a public, unauthenticated AI-calling form.
- `npm run lint` and `npm run build` stay clean.

**Security note, since this is the first genuinely public write path besides `conversion_events`'s anon-insert click route:** writes run through the service-role client inside a Server Action rather than an anon RLS insert policy — `roadmap_leads` has no insert policy for any client-facing role at all, only Super-Admin select/update. Stricter than the `conversion_events` pattern, appropriate here since this write happens inside trusted server code rather than a bare public redirect.

**Open item:** the "Call now"/"WhatsApp now" buttons on the generated roadmap read `NEXT_PUBLIC_VMG_WHATSAPP_NUMBER`/`NEXT_PUBLIC_VMG_PHONE`, both unset as of this writing — falls back to a `mailto:hello@visionarymastersglobal.com` link until VMG's real number is added to `.env.local`/Vercel.

Schema: `supabase/migrations/0024_phase9_roadmap_leads_schema.sql` + `0025_phase9_roadmap_leads_rls.sql` (not yet applied to the live project as of this writing — run manually in the Supabase SQL Editor).

## Phase 10 — Local SEO Toolkit (post-spec, next of the "best of best" roadmap)

Same external gate as GBP everywhere else in this document: real Google Business Profile API access needs a 60+ day verified profile and a formal access request, so there's no automated posting or live listing data here. Scoped to what's genuinely buildable today — the same "draft here, do it yourself" discipline as Phase 8.

**Exit criteria met:**
- A client can save their business's address/city/state/pincode/GBP category/GBP link, and see a plain NAP-consistency checklist against what's already in Brand Brain and their Local SEO profile.
- A client can mark which of a fixed set of common citation directories (Google, Facebook, Bing Places, Apple Maps, Justdial, Sulekha, IndiaMART, Yelp) they're already listed on — no scraping, a manual checklist.
- A client can get an AI-drafted "Google Post" (offer/update text) plus 5 local keyword suggestions in one generation, copy the text, and mark it posted once they've put it on their own GBP account.
- `npm run lint` and `npm run build` stay clean.

Schema: `supabase/migrations/0027_phase10_local_seo_schema.sql` + `0028_phase10_local_seo_rls.sql` (run manually in the Supabase SQL Editor — same as every migration since this session's Supabase MCP connection isn't linked to this project).

## Phase 11 — AI Search Visibility / AEO (post-spec)

"AEO" (Answer Engine Optimization) here means: does the client's own site give an AI answer engine (ChatGPT, Gemini, Perplexity, Google AI Overviews) clear, quotable facts when someone asks it something like "best chocolate shop in Pune"? There's no API to query those engines' live outputs, and simulating one would risk implying a guaranteed-visibility claim — the exact thing every AI-generation call site in this app is explicitly built to avoid. So this is a real crawl-based audit of the on-page signals those engines are known to rely on (structured data, FAQ-shaped content, plain NAP text, review signals), scored 0-100 like the Phase 3 SEO audit, plus an AI-drafted FAQ block addressing whatever gaps it finds.

**Exit criteria met:**
- A client can run a real audit of their own site (no third-party API) and see a 0-100 score with a specific finding per signal checked.
- A client can generate an AI-drafted FAQ section (4-6 Q&A pairs) targeted at the actual gaps found, to copy onto their own website.
- Never claims or implies real-time monitoring of actual AI engines, or guarantees any ranking/visibility outcome.
- `npm run lint` and `npm run build` stay clean.

Schema: `supabase/migrations/0029_phase11_aeo_schema.sql` + `0030_phase11_aeo_rls.sql` (run manually in the Supabase SQL Editor).

## Phase 12 — Competitor Search (Apify), a premium add-on

Unlike the GBP-gated features above, real Google SERP data doesn't need a slow external approval — it needs a paid scraping vendor (Apify), which is exactly the "new paid vendor relationship" line already declined twice (Phase 3 competitor tracking, Phase 5 backlink data) absent explicit sign-off. The owner explicitly asked for this one, with two conditions that shape the whole design:

1. **Bring-your-own-account, not VMG-shared.** Each client connects their own Apify account (their own API token, pasted in like a Google review link — Apify has no per-client OAuth) so usage bills to *their* Apify account. There's no shared-cost problem for VMG to manage, unlike Buffer's shared-account model in Phase 4.
2. **Premium, admin-gated.** A new `client_settings.premium_apify_enabled` boolean, off by default — only a Super Admin can switch it on per client (`setPremiumApifyAction`, admin client detail page), same manual-approval spirit as Phase 1's payment verification. A client without it sees a plain "ask your contact to enable this" card instead of the tool.

**Exit criteria met:**
- A client (once enabled) can connect their own Apify API token and run a real Google Maps search (term + location) via the Google Maps Scraper actor (`compass/crawler-google-places`) — chosen over a generic web-search scraper because local-pack listings (competing businesses, their rating/review count/category) are what actually matters for a local-business client. Actor id, input shape, and every output field were confirmed via a real live run before writing the parser, not guessed.
- Results show real business listings ranked as Google Maps ranks them, and when the client's website is connected (`org_links`), exactly which rank (if any) their own domain holds.
- Every search is saved as a snapshot the client can scroll back through.
- `npm run lint` and `npm run build` stay clean.

**Known, inherited limitation (since closed by `0034` — see Post-Phase-12 additions):** `client_settings`'s existing owner-update RLS policy (`client_settings_owner_update`, added in Phase 7) is row-level, not column-level — same as every other column already on that table (e.g. `manual_buffer_cost_usd`), a technically-savvy client could in principle flip their own `premium_apify_enabled` via a raw API call, bypassing the UI. This is a pre-existing characteristic of the table's trust model, not something new introduced here.

Schema: `supabase/migrations/0031_phase12_apify_schema.sql` + `0032_phase12_apify_rls.sql` (run manually in the Supabase SQL Editor).

> **What comes next is in [ROADMAP.md](ROADMAP.md)** — Waves 1–3, what each needs from the owner, and what was decided against (n8n).

## Post-Phase-12 additions

- **"Clear all posts" (Content Planner)** — bulk-deletes drafts/waiting-approval/scheduled items in the currently viewed window, two-step confirm, skips locked items and never touches anything already `publish_status='sent'`. `clearPlannerAction` in `app/app/planner/actions.ts`.
- **Buffer post insights** — on-demand (client clicks "Refresh insights") engagement metrics for published Facebook/Instagram posts, using Buffer's real `Post.metrics` GraphQL field (`{type, name, value, unit}[]`, normalized across networks — reactions/comments always present, richer fields like impressions/reach/engagementRate appear only when the specific network reports them). Query shape verified against developers.buffer.com's own "Get Post Metrics" example before writing `getBufferPostMetrics()` in `lib/buffer/client.ts`, not guessed. Stored in `content_items.insights`/`insights_synced_at` (`supabase/migrations/0033_buffer_post_insights.sql`).
- **Admin-only column protection on `client_settings`** — closes the inherited hole noted under Phase 12 (row-level owner-update policy let a client write `premium_apify_enabled`, the `manual_*` cost fields, `automation_status`, and `org_id`). A BEFORE UPDATE trigger now rejects those columns for any logged-in non-Super-Admin session; the service-role client (cron) is unaffected. `supabase/migrations/0034_protect_client_settings_admin_columns.sql`.
- **Reliability pass (from the September 2026 audit)**:
  - **Automated tests + CI** — vitest (`npm test`; 380 tests in `tests/` as of 2026-09-26, grown with each feature below) covering the AI-JSON parser, the AEO audit's scoring, the Apify and Buffer clients, the config checks, the avoided-words policy check, publish scheduling and dispatch, insights aggregation and the token secret box; `.github/workflows/ci.yml` runs typecheck + lint + tests on every push/PR. Writing the AEO tests immediately caught a real bug (the trust-signal regex didn't match plural "reviews"/"testimonials", so a page saying "300 reviews" was scored as having none) — fixed.
  - **Shared AI JSON helper** — `lib/ai/parse-json.ts` replaces seven copy-pasted `JSON.parse` blocks (three had no failure handling and could crash a page); a bad model response is now always a retry-able `AiGenerationError`.
  - **Admin Config Health** (`/admin/health`) — which required/optional deployment settings are present (presence only, never values) plus the last run of each scheduled job; a red banner on the admin dashboard when a required setting is missing. The nightly Autopilot cron now records every run in `cron_runs` (`0035_cron_runs.sql`) and counts a run as failed when any org generated nothing because of an error — previously it reported success with `created: 0`, which is how it could be broken for days unnoticed.
  - Homepage module list brought up to date (was "nine modules"); Offboarded/paused/expired accounts no longer see the "registration being reviewed" message.
- **GEO / AI-visibility work (from the same audit)**:
  - **Schema markup generator** (`lib/aeo/schema-markup.ts`, shown on the AI Search Visibility page) — deterministic LocalBusiness JSON-LD from Brand Brain + Local SEO profile + connected links, and FAQPage JSON-LD from the drafted FAQ. No AI, nothing invented (no country is assumed; missing fields are omitted and listed), and `<` is escaped so client text can't close the script tag. The audit used to only say "no structured data"; this closes the gap it reports.
  - **"What Google's AI actually says"** (`lib/apify/ai-visibility.ts`, `lib/aeo/mentions.ts`, migration `0036_ai_visibility_checks.sql`) — premium add-on on the client's own Apify account: asks Google AI Mode up to 5 customer-style questions and records whether the business is named, its site cited, and which competitors are named instead. **Scope decision:** only Google AI Mode is wired up, because it is the only add-on of Apify's Google Search scraper whose output shape (`aiModeResult.text` + `sources[]`) is documented with a real example; ChatGPT/Perplexity/Gemini/Copilot/AI Overview exist as add-ons but their output property names are not documented, and guessing them would bill the client for results we might silently misread. Every check stores the raw payload (`raw`) so those engines can be added after one real run confirms the shape. Never runs automatically; cost (~$0.21/question at Apify free-tier prices) is shown before the click. Not verified against a live run yet — the parser is covered by tests against the documented shape only.
  - **Visibility Score** (`/app/visibility`, `lib/visibility/score.ts`) — one transparent number: the plain average of whichever of {SEO audit score, AI Search audit score, NAP completeness, directory listings} have been measured (unmeasured ones are shown as "not measured", never counted as zero), with the delta vs the previous audit. Reviews, Maps position and AI-answer mentions are shown alongside as separate real numbers, not blended in. Explicitly not a Google or AI ranking.
  - **Apify run timeout** — `apifyRunSync` (shared by Maps search and the AI check) aborts at 55s with a message that the run may still be billed, and the two pages export `maxDuration = 60`, because a live Apify run (~12s+) could otherwise be killed by the default serverless limit mid-flight.
- **Tenant isolation test** — `supabase/tests/tenant_isolation_test.sql`: a rolled-back DO block that impersonates two real clients (RLS-authenticated role + their user id) and checks neither can read or write the other's rows in every public table with an `org_id` column, with positive controls so a broken simulation can't give a false PASS. Also reports whether the admin-column hole is open (before 0034) or closed (after). Returns its report as an ordinary result table (it never raises; a run that can't happen says `NOT RUN`), so it is safe to paste with the migrations. Does not cover Storage bucket policies or the `anon` role. **First live run 2026-09-22 (production, run by the owner): 36 tables, 0 leaks, admin-only columns `PROTECTED`, `RESULT: PASS`.**
  - **Also runs on every push** (`tests/rls-isolation.test.ts` + `tests/helpers/pg-harness.ts`): all 36 migrations are loaded into an in-memory Postgres (PGlite) behind small stand-ins for Supabase's `auth`/`storage` schemas and roles, both tenants are seeded with a row in every one of the 36 org-scoped tables (the test fails if any table can't be seeded, since "no leak" would then be vacuous), and the SQL test is run against it. Checked when it was written: PASS on the real policies, `VULNERABLE` before 0034 and `PROTECTED` after, and it reports `LEAK` when a read or write hole is deliberately added — so a new migration that fails to apply, or quietly opens a hole, now fails CI. The suite also re-runs 0033–0036 to prove they are re-runnable, proves the test leaves no trace (data and role restored) even with a hole open, and proves it can be pasted in one query with the migrations without ever undoing them. **Limit:** it tests the migration files, not the live project; if the live database was ever changed by hand, only running the SQL file in the Supabase SQL Editor sees that.
- **Publishing correctness pass** — found by writing tests for the send path (`lib/publishing/schedule.ts`, `lib/publishing/dispatch.ts`, `tests/schedule.test.ts`, `tests/dispatch.test.ts`); none of these had ever been exercised against a real send, so all were latent:
  - **Wrong send time.** A slot's `scheduled_time` comes back from Postgres as `"09:00:00"` (a `time` column), which the old code glued into an invalid timestamp; and even when it parsed, it was read as server time (UTC on Vercel) instead of the IST the planner shows, so a 9:00 AM post would have gone out at 2:30 PM IST. Slot times are now IST wall-clock (`PUBLISH_UTC_OFFSET_MINUTES = 330`, fixed — India has no DST) converted with `toUtcIso`, and a slot whose time has already passed is refused with a plain message instead of being sent to Buffer as a past-dated post.
  - **Autopilot generated duplicates.** The nightly top-up compared `"09:00"` slot keys against `"09:00:00"` database values, never matched, and so treated every already-filled slot as empty (`computeBufferState` in `lib/planner/buffer.ts` normalizes both sides; past slots count as covered).
  - **Posts approved before a channel existed were never sent.** Nothing revisited them once a Buffer channel was linked. `linkBufferChannelAction` now sends the still-upcoming ones straight after linking (`flushPendingPublishing`; past ones are left alone, and a failure there never fails the link).
  - **"Send now" / "Retry"** on a scheduled post in the planner (`sendNowAction`) — the manual path for anything that didn't go out, with the reason shown on the post rather than a silent failure.
  - **Instagram needs media.** A text-only Instagram post is now stopped with "Instagram needs an image or video…" instead of being rejected by Buffer after the fact.
  - **Insights summary** on the planner (`components/planner/InsightsSummary.tsx`, `lib/planner/insights.ts`) — one card with "Refresh all insights" and additive totals (reactions, likes, comments, shares, clicks, impressions, saves, views) across the published Facebook/Instagram posts in view. Rate-style metrics such as engagement rate are never summed.
  - The planner's intro copy, the assistant's ambiguous-slot message and the time shown on each card now read the same IST wall-clock time (`normalizeSlotTime`).
- **Secrets at rest** — `lib/security/secret-box.ts`: optional AES-256-GCM encryption of Google OAuth tokens and clients' Apify API tokens, switched on by setting `TOKEN_ENCRYPTION_KEY`. Backward compatible (no key = stored as before; legacy plain-text values keep working; only newly written tokens are encrypted), and an undecryptable token reads as "not connected" so the client is asked to reconnect rather than the page crashing. Details and the never-lose-the-key warning in `SECURITY_AND_RLS.md`. `runCompetitorSearchAction` now reads the token through `getConnectedApifyToken` like every other Apify path instead of touching the column itself.
- **Admin dashboard job banner** — red when the nightly Autopilot job's last run failed, amber when it hasn't run in 36 hours (`getLastCronRun` + `cronHealth`); "never run" and a missing log table stay on the Config Health page only.
- **Creative Studio v1 (post graphics)** — the first item of the "Wave 1" plan that came out of the 2026-09-26 comparison against the 2026 marketing-tools landscape (its "Visual Content" gap: text-only output, only a raw stock photo): every planner post can now get a finished graphic instead of only a raw stock photo. Press **Create image** on a Facebook/Instagram post, or use the **Post graphics** card to make graphics for the next 20 posts that have no picture of their own (one request per post, so no time limit is hit; the client still approves every post).
  - **Four looks** — offer, tip/quote, festival wish, spotlight — chosen automatically from the caption (`pickStyle`) or by hand, in the client's Brand Brain colours with their logo, the post's own words as the headline, and (offers only) their WhatsApp/phone. Square for Facebook, 4:5 for Instagram. Text uses Poppins, so **Hindi (Devanagari) renders correctly** — checked visually, conjuncts included.
  - **Three backgrounds, all free** — brand colours (unlimited, no service), Unsplash stock photo (already integrated), and an **AI photo** from Cloudflare Workers AI FLUX.1 schnell. Chosen after checking the alternatives against their official pages on 2026-09-26: **Gemini's image API has no free tier** (paid-only, about $0.039 an image), while Cloudflare's free plan gives 10,000 "neurons" a day (roughly 170+ images) and simply stops when they run out — it never bills. "Auto" tries AI, then stock, then colours; an explicit choice reports its own failure instead of silently substituting.
  - **Protecting the free allowance** — `creative_generations` (`0037`) logs every graphic; before an AI photo, the server counts today's rows per business (20) and platform-wide (150, override with `CREATIVE_AI_DAILY_LIMIT`) and **fails closed** if it can't count. Only the server writes that table, so a client can't fake usage to block others. Days reset at 00:00 UTC (5:30 AM IST), matching Cloudflare.
  - **How it draws** — `satori` (flexbox layout to SVG, with harfbuzz text shaping) and `sharp` (JPEG), no headless browser and no paid service; fonts are embedded in the code. Not `next/og`: its bundled copy breaks on Windows paths containing spaces, which would have made local testing impossible. A new graphic replaces the earlier generated one and the auto-attached stock photo, never a client's own upload.
  - **Deployment gotcha found and fixed** — harfbuzz loads `hb.wasm` by a runtime path that Next's file tracing can't see, so the deployed function would have lacked it and every graphic would have failed in production while working locally. `next.config.mjs` now ships it explicitly (`outputFileTracingIncludes`), and a simulated deploy using only the traced files renders correctly (and fails without the file, confirming the cause).
  - **Not verified against the real service yet** — the first real Cloudflare call needs the account keys; the request/response handling is covered by tests written from Cloudflare's documented shape, and `DEPLOYMENT_CHECKLIST.md` lists the first live check.
- **Idempotent migrations + `DEPLOYMENT_CHECKLIST.md`** — `0033`–`0036` can be re-run safely (`if not exists` / `drop … if exists`), so one combined paste into the Supabase SQL Editor is harmless even if a piece was applied earlier. The checklist covers environment variables, the Supabase Site URL, migration order and the post-deploy checks.
- **Picture idea (Content Planner)** — every post now has a "what should the picture show" description. The AI suggests one alongside each new caption (`image_idea` in its reply); it shows under the caption and is editable in the post's Edit form. **Create image** opens with a "Describe the picture you want" box, idea chips built from the business's own product (`firstProductPhrase`), and an optional "Change the words on the picture". **Nothing is generated until the client presses Create image**, an AI photo asked for by name requires a description, and what was typed is saved on the post for reuse. The AI-photo prompt leads with the description (a photograph unless the client asked for an illustration/render) and the stock-photo search uses it too. Migration `0038` adds `content_items.image_prompt`; because the code deploys before the SQL is run, every write that includes the column falls back to the old behaviour on a database without it (`tryWithOptionalColumn`). Also fixed while there: "Copy" on a post reuses the same stored file, and replacing a graphic used to delete that file out from under the copy — files are now removed only when no other post points at them.
- **Command Center (client home page)** — `app/app/dashboard/page.tsx` was an admin-flavoured status page (package, expiry, verification, a grid of 15 modules, raw event names). It now opens on what the client needs, in this order: **Needs your attention** (fix-now / to-do / tip items, each linking to the page that fixes it — failed sends, Google connections to reconnect, no publishing channel linked, upcoming posts without a graphic, reviews needing a reply, package ending, brand not filled in), **Ready for your approval** (up to four posts with an **Approve** button right there — the same `decideContentAction` the planner uses), **Your results** (six tiles: clicks from Google, website visits, visibility score, leads & sales, reviews, posts lined up — each with the change since the previous reading and, when there is real history, a small trend line), **What's been happening** (audit-log entries in plain words; logins hidden), the account details, and the tool grid. Honest by construction: a source that isn't connected says what to connect instead of showing a zero, and trends only compare snapshots that cover the same number of days. All the logic is in `lib/dashboard/command-center.ts` (pure, `tests/command-center.test.ts`). Dates use India time. Found and fixed on the way: rejecting or skipping a post was logged as `content_rejectd` / `content_skipd` (a string-building typo); old entries still read correctly.
- **Monthly PDF report** — each report on `/app/reports` has a **Download PDF** button (`app/app/reports/[id]/pdf/route.ts`): two A4 pages in the client's brand colours and logo — page 1 the numbers (SEO score, Google clicks and average position, website visits, with the change since the last report; plus impressions, click-through rate, visitors, conversions and post counts), page 2 the written "Work completed" and "Plan for the next period" and a note that no result is promised. Drawn the same way as post graphics (`satori` + `sharp`, so Hindi renders correctly), then placed on A4 sheets with `pdf-lib` (`lib/reports/`). Only figures already stored in the report are shown; a Google source that wasn't connected says "Not connected yet", never 0. Long text shrinks or is shortened with "…" rather than running off the page. The route reads only the signed-in member's own report (row-level security plus an explicit org filter, tested). Limit: pages are images, so the text in the PDF can't be selected or searched. Found and fixed on the way: the report's AI summary was always told the SEO audit found **0 issues** (`issueCount` was hard-coded), so it could write "0 issues found" about a site with several; it now uses the real count.
- **`ROADMAP.md`** — the plan for Waves 1–3 after the 2026-09-26 review: what is built, what is next, what needs an account or approval only the owner can give, and what was decided against (n8n).
- **Customers & WhatsApp** (`/app/contacts`, migration `0039`) — Wave 2.1 in `ROADMAP.md`. A private customer list per business (name, WhatsApp number, tags, a note, and whether the customer **agreed** to receive messages / later **asked to stop**), added one at a time or pasted in bulk (up to 500 lines; the reader copes with "Name, number", "number, Name", "Name - number", tab/semicolon lists and a spreadsheet's header row, and reports each unusable line with the reason). Above it, a **message composer**: ready-made English and Hindi messages (offer, festival wishes, thank-you, review request, something new, reminder) that the client edits; `{name}` becomes each customer's first name and `{business}` the business name, and `{details}` is a gap the client must fill before anything can be opened. Then **Open WhatsApp** beside each customer who agreed and hasn't opted out — a `wa.me` click-to-chat link with the personalised text; **the client presses send in WhatsApp themselves**, so nothing is ever sent by the app, it goes from their own number, and there's no bulk-sending or spam risk. At most 50 people are listed at a time (narrow by tag for the rest). Numbers are stored as digits with the country code (`lib/contacts/phone.ts`: 10-digit Indian mobiles get 91; other countries need a `+`; 91-prefixed numbers must be a real 10-digit mobile). Privacy: only the business's own members can read or write these rows — deliberately **not** a Super Admin — checked by its own test on every push; the audit trail records that customers were added/imported/removed but never their names or numbers. Until `0039` is run, the page says it isn't set up yet and hides its forms.
- **"Today" now means today in India** — the planner's first day, the Autopilot buffer, "send pending posts", the assistant's date, a report's end date and the client home page all used the server's UTC date in places, which is still yesterday between midnight and 5:30 AM IST. They now share `lib/utils/ist.ts` (`istDateString`, `addDays`, `nextDays`; `tests/ist.test.ts` covers the small-hours case). Slot *times* were already India time (`lib/publishing/schedule.ts`).
