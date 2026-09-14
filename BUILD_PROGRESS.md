# Digital Command — Build Progress

Last updated: Phase 5 build.

## Phase 1 — ✅ Complete
## Phase 2 — ✅ Complete
## Phase 3 — ✅ Complete
## Phase 4 — ✅ Complete

Full detail in this file's git history. Summarized: Phase 1 = branding, auth, multi-tenant DB+RLS, registration, verification, manual payment, Super Admin approval → activation. Phase 2 = Brand Brain, links, real Claude-powered 7-Day Planner with Autopilot/Approval Required, notifications. Phase 3 = real crawl-based SEO audit, Google Search Console/Analytics OAuth + keyword tracking, AI-narrated on-demand reports. Phase 4 = real Buffer publishing (Facebook/Instagram, corrected to VMG's actual shared-account API model after verifying Buffer's current docs), real YouTube upload, the publishing-adapter dispatch finally wired in.

## Phase 5

### ✅ Completed (built and verified — lint/build clean, `/app/outreach` confirmed to render/guard correctly in-browser)

- **Real off-page opportunity assessment** — a candidate URL is actually crawled (`lib/web/fetch-page.ts`, extracted from the Phase 3 SEO audit's crawl pattern so it isn't duplicated) and Claude judges relevance/quality/spam-risk from the real fetched content, never invented
- **Real contact discovery** — `mailto:` links and a detected contact-page URL, extracted from the actual page
- **Real brand-mention search** — Google Custom Search JSON API (new, free-tier, no OAuth), each result one click from becoming a tracked opportunity
- **Real personalized outreach drafting** — one opportunity at a time, references the target page's actual content, no template/bulk mechanism exists anywhere in the schema or UI (structural, not policy-based, compliance with spec's no-mass-spam rule)
- **Real backlink verification** — re-fetches the opportunity's own URL and checks for an actual link to the client's domain; flips to `link_acquired` or `lost` for real
- Sending stays manual by design — a pre-filled `mailto:` link, not a new email-provider integration (still an open item since Phase 1)
- Super Admin read-only "Off-Page Activity" opportunity-count summary
- `npm run lint` — clean; `npm run build` — clean full production build + type check
- Route guard re-verified in-browser: `/app/outreach` correctly redirects unauthenticated visitors

### 🟡 Built, needs a live Supabase project + real Anthropic/Custom-Search credentials to verify end-to-end

- The full add-opportunity → assess → draft → send → verify-backlink loop (code is complete and reviewed; needs real credentials and a real target site to exercise)

### ⬜ Not started (explicitly out of Phase 5 scope, by design — asked the user twice, Phase 3 and Phase 5, same answer both times)

- **Backlink-index-class data**: competitor backlink analysis, web-wide automated opportunity discovery, lost-backlink monitoring beyond what this pipeline already tracks, local citation checks, digital PR opportunity discovery — all need a paid Ahrefs/Semrush/Moz-class provider, deferred rather than start that vendor relationship without explicit sign-off (spec §36)
- Google Business Profile (unchanged from Phase 4 — separate approval gate)
- Automated/bulk outreach sending of any kind — deliberately absent, not deferred (see Security note below)
- AI cost cap on opportunity assessment or outreach drafting (the planner caption cap doesn't cover these — flagged in `SECURITY_AND_RLS.md`, same open item as Phase 3/4's report-narrative and publish-dispatch gaps)

### 🔴 Blocked

- None currently.

### ⚠️ Needs external setup / verification (owner action required)

- Create a Google Programmable Search Engine (programmablesearchengine.google.com) set to search the entire web, enable the Custom Search API in the same Google Cloud project as Search Console/Analytics/YouTube, get `GOOGLE_CUSTOM_SEARCH_API_KEY`/`GOOGLE_CUSTOM_SEARCH_ENGINE_ID`
- Run migrations `0012`–`0013` against the same Supabase project as Phases 1–4
- With real data: add a real candidate URL and sanity-check the AI's relevance/quality/spam assessment against your own judgment; run a brand-mention search; draft and review an outreach email for tone before ever sending one for real
- Decide on a backlink-index-class data provider whenever that becomes a priority (unchanged decision point from Phase 3)
