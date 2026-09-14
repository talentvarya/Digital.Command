# Digital Command — Build Progress

Last updated: Phase 6 build.

## Phase 1 — ✅ Complete
## Phase 2 — ✅ Complete
## Phase 3 — ✅ Complete
## Phase 4 — ✅ Complete
## Phase 5 — ✅ Complete

Full detail in this file's git history. Summarized: Phase 1 = branding, auth, multi-tenant DB+RLS, registration, verification, manual payment, Super Admin approval → activation. Phase 2 = Brand Brain, links, real Claude-powered 7-Day Planner with Autopilot/Approval Required, notifications. Phase 3 = real crawl-based SEO audit, Google Search Console/Analytics OAuth + keyword tracking, AI-narrated on-demand reports. Phase 4 = real Buffer publishing (Facebook/Instagram, corrected to VMG's actual shared-account API model after verifying Buffer's current docs), real YouTube upload, the publishing-adapter dispatch finally wired in. Phase 5 = real off-page opportunity assessment (crawl + AI), real contact discovery, real brand-mention search (Google Custom Search), real personalized (never bulk) outreach drafting, real backlink verification — backlink-index-class data (competitor analysis, web-wide discovery) deferred by explicit user choice.

## Phase 6

### ✅ Completed (built and verified — lint/build clean, `/app/paid-campaigns` confirmed to render/guard correctly in-browser)

- **Real AI campaign drafting** (`lib/ai/prepare-campaign.ts`) — audience, keywords, and creative brief drafted by Claude from Brand Brain + a client-described goal; budget guidance is explicitly qualitative-only (a starting-point range framed for evaluation), never a number presented as authoritative — the one AI output in this app adjacent to real money
- **Real client-set spend authorization** — `max_spend`, `budget_period`, `start_date`, `end_date` are always entered by the client themselves, never AI-set, never admin-set; `approveCampaignAction` refuses to approve until all four are present
- **Real approve/reject workflow with an explicit confirmation checkbox** — server-side enforced, not just a UI nicety; every decision is an immutable, versioned `paid_campaign_approvals` row (who, when, from where, exactly what budget/dates it covered) — spec §14's field list, built for real
- **Editing an approved or rejected campaign automatically resubmits it for approval** — an approval is only ever valid for the exact parameters it covered
- **The client-approves-spend rule is enforced at the code-path layer, not just the UI**: only `app/app/paid-campaigns/actions.ts` can ever write `approved`/`rejected`/`pending_approval`; only `app/admin/clients/[orgId]/paid-campaign-actions.ts` can write the post-launch statuses, and it validates against an explicit allowlist that excludes every client-only status — see `SECURITY_AND_RLS.md`
- **Super Admin "Mark Launched" + "Update Status/Performance"** — the only two admin write actions on this table, only reachable after client approval, recording what VMG actually did on the ad platform and what they see in its dashboard
- Dashboard gained a real "Paid Advertising" module card (previously nonexistent, not even a placeholder — spec treats paid ads separately from the core module set)
- `npm run lint` — clean; `npm run build` — clean full production build + type check
- Route guard re-verified in-browser: `/app/paid-campaigns` correctly redirects unauthenticated visitors to `/login`

### 🟡 Built, needs a live Supabase project + real Anthropic credentials to verify end-to-end

- The full draft → edit → submit → approve/reject → (admin) mark launched → update performance loop (code is complete and reviewed; needs real credentials and a real campaign to exercise, including confirming the approval-version/resubmit-on-edit logic against real rows)

### ⬜ Not started (explicitly out of Phase 6 scope, by design — asked the user directly before scoping this phase)

- **Live Google Ads API / Meta Marketing API integration** — nothing in this codebase calls either platform. Researched current access requirements first: Google Ads API Basic Access can now be approved in hours with brand verification; Meta's Marketing API needs Business Verification + App Review specifically because Digital Command would manage other businesses' ad accounts. User's explicit choice: build prepare + approve + audit for real, keep "make it live" a manual, external, human action. See `PROJECT_PLAN.md`'s Phase 6 section and `API_INTEGRATIONS.md`.
- Automatic campaign optimization, bid management, A/B testing — out of scope for a system of record
- Scheduled/automatic performance sync — spend/clicks/conversions are manually entered by Super Admin (no live API connection exists to sync from)
- AI cost cap on campaign drafting — same open item already flagged for report-narrative/publish-dispatch/opportunity-assessment/outreach-drafting

### 🔴 Blocked

- None currently.

### ⚠️ Needs external setup / verification (owner action required)

- Run migrations `0014`–`0015` against the same Supabase project as Phases 1–5
- No new environment variable or vendor account needed — campaign drafting reuses the existing `ANTHROPIC_API_KEY`
- With real data: draft a campaign, sanity-check the AI's audience/creative/budget-guidance against your own judgment, fill in real budget/dates, approve it, then (as Super Admin) practice the Mark Launched / Update Status/Performance flow with placeholder values before a real campaign goes through it
- Decide, whenever it becomes a priority, whether to pursue real Google Ads/Meta Marketing API access for direct launch/performance sync (unchanged decision point — see `API_INTEGRATIONS.md`)
