# Digital Command — Project Plan

Source of truth: `Digital_Command_Claude_Master_Build_Spec.md` (owner-supplied). This file tracks how that spec maps to build phases; it does not restate the spec.

## Phases (spec §35)

| Phase | Scope | Status |
|---|---|---|
| 1 | Branding shell, Supabase Auth, multi-tenant DB + RLS, Super Admin, client registration, policy acceptance, business verification, manual payment verification, client activation | ✅ Built |
| 2 | Client dashboard, Brand Brain, website/link setup, 7-day planner, Autopilot/Approval Required, content versions, notifications | ✅ Built |
| 3 | SEO audit, Search Console, Analytics, reporting, graphs, keyword/competitor tracking | ✅ Built |
| **4** | Buffer integration, Facebook/Instagram publishing, YouTube, GBP/Local SEO | **This build — GBP deferred, see below** |
| 5 | Off-page opportunity engine, outreach, digital PR, backlink verification | Not started |
| 6 | Paid campaign preparation, manual approval, budget/date controls, ad reporting | Not started |
| 7 | Client AI Assistant, conversion tracking, cost dashboard, backup/rollback, API health center, emergency freeze, offboarding, sandbox | Not started |

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
