# Digital Command — Build Progress

Last updated: Phase 4 build.

## Phase 1 — ✅ Complete
## Phase 2 — ✅ Complete
## Phase 3 — ✅ Complete

Full detail in this file's git history. Summarized: Phase 1 = branding, auth, multi-tenant DB+RLS, registration, verification, manual payment, Super Admin approval → activation. Phase 2 = Brand Brain, links, real Claude-powered 7-Day Planner with Autopilot/Approval Required, notifications. Phase 3 = real crawl-based SEO audit, Google Search Console/Analytics OAuth + keyword tracking, AI-narrated on-demand reports.

## Phase 4

### ✅ Completed (built and verified — lint/build clean, new/changed routes confirmed to render/guard correctly in-browser)

- **Real Buffer publishing** for Facebook/Instagram — verified Buffer's actual current API before building (not from potentially-stale training knowledge), found the spec's assumed per-client-OAuth model isn't available, corrected course with the user (two rounds of AskUserQuestion), and built against the real model: one shared VMG Buffer account, admin-linked channels per client (`buffer_channel_links`, `lib/buffer/client.ts`)
- **Real YouTube publishing** — direct YouTube Data API v3, multipart upload, scheduled via `publishAt` (extends Phase 3's Google OAuth pattern with a third service)
- **The publishing-adapter seam, finally real** — `lib/publishing/dispatch.ts`, wired into all three places a `content_item` reaches `status='scheduled'` (approve, Autopilot auto-schedule, client manual upload)
- **`status='published'` is reachable for real** for the first time — an on-demand status check (`checkPublishStatusAction`) confirms against Buffer/YouTube and flips it, or records a `publish_error`
- Admin "Publishing Channels" panel — links a client's org+platform to one of VMG's live Buffer channels (fetched from Buffer, not hardcoded)
- Client-facing: planner cards show publish status + a "Check Status" action; `/app/seo` shows YouTube as a third connectable Google service plus a read-only "which channel is my Facebook/Instagram linked to" card
- `npm run lint` — clean; `npm run build` — clean full production build + type check
- Route guards re-verified in-browser: `/app/seo`, `/app/planner`, `/admin/clients/[orgId]` all correctly redirect unauthenticated visitors

### 🟡 Built, needs a live Supabase project + real Buffer/Google credentials + an actual linked channel to verify end-to-end

- The full dispatch → Buffer/YouTube → status-confirmation loop (code is complete and reviewed against Buffer's real GraphQL schema and YouTube's documented multipart-upload shape; needs real credentials, a real client channel connection, and a real scheduled post to exercise)

### ⬜ Not started (explicitly out of Phase 4 scope, by design)

- **Google Business Profile** — GBP API access needs a separate, stricter approval (60+-day-old verified profile, business website, formal review, 0 QPM until approved — no Test-User workaround like Search Console). Revisit once the user has an eligible profile and wants to start that process.
- Direct Facebook/Instagram Graph API as a fallback to Buffer — the adapter already isolates this behind a function boundary if it's ever needed later
- Competitor tracking (unchanged from Phase 3 — explicit deferral)
- Off-Page SEO, Local SEO/GBP (Phase 5+)
- Resumable YouTube uploads for very large files (multipart is simpler and correct for now; upgrade path noted if serverless limits become a real problem)
- AI cost cap on report generation or publish-dispatch (the planner caption cap doesn't cover these — flagged in `SECURITY_AND_RLS.md`)

### 🔴 Blocked

- None currently.

### ⚠️ Needs external setup / verification (owner action required — read `supabase/README.md` §5–6 first)

- **Get a Buffer account with API access** and create a personal API key for `BUFFER_ACCESS_TOKEN` — this is VMG's own account/subscription, a real recurring cost, confirmed with the user before building
- **Add each client's Facebook Page/Instagram account as a channel** on buffer.com (requires that client's Facebook login), then link it to the right org from the admin panel
- **Extend the Phase 3 Google Cloud OAuth app** with the YouTube Data API v3 enabled + `youtube.upload`/`youtube.readonly` scopes added to the consent screen
- Run migrations `0010`–`0011` against the same Supabase project as Phases 1–3
- With real data: approve a piece of Facebook/Instagram content and confirm it actually lands in Buffer as a scheduled post; upload a YouTube video through the planner and confirm it appears (private, scheduled) on the connected channel; run the status check and confirm `published` gets set for real
- Decide whether/when to start Google's Business Profile access-request process (needs a 60+-day-old profile first)
- Decide on a competitor-tracking data provider whenever that becomes a priority (unchanged from Phase 3)
