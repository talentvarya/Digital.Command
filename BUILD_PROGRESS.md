# Digital Command — Build Progress

Last updated: Phase 2 build.

## Phase 1 — ✅ Complete (see prior notes below, unchanged)

Branding shell, auth, multi-tenant DB+RLS, registration with consent gate, business verification, manual payment, Super Admin approval → activation. `npm run lint` / `npm run build` clean at time of delivery. Full detail in the "Phase 1" section further down this file's git history — summarized here since Phase 2 builds directly on it.

## Phase 2

### ✅ Completed (built and verified — lint/build clean, routes confirmed to render/guard correctly in-browser)

- Brand Brain (`/app/brand`) — every field from spec §18, logo upload, feeds AI prompts directly
- Website & Channel Connections (`/app/links`) — add/edit/remove, **real** server-side reachability health check (HEAD, falling back to GET), status badges
- 7-Day Content Planner (`/app/planner`) — day-by-day view, AI generation, manual content upload, Approve/Edit/Reject/Generate Another/Skip, media add/remove, reschedule, copy to another day, lock/unlock, delete
- **Real AI generation** — Anthropic API (`claude-haiku-4-5-20251001`), Brand-Brain-aware prompts, strict-JSON parsing with fallback, real error surfacing (not swallowed)
- **Real policy check** — generated captions are scanned against Brand Brain's "words to avoid"; a hit forces `waiting_approval` even under Autopilot, with the client notified why
- Revision flow per spec §10 — 3 free regenerations, then a client suggestion is required to continue, then only Approve/Skip
- Autopilot / Approval Required mode switch, including the "approval required for 7 days then Autopilot" option
- In-app notifications (bell + unread count + mark-all-read) — account activation and "AI content held for review" events wired up
- Super Admin read-only "Brand & Content" visibility on the client detail page — no admin edit access, matching spec's client-owns-approval model
- A monthly per-org AI-generation safety cap (`lib/constants/content.ts`), addressing spec §30/§36's "don't let this become loss-making / no unlimited promises" concern
- `npm run lint` — clean; `npm run build` — clean full production build + type check
- Route guards re-verified in-browser: `/app/brand`, `/app/links`, `/app/planner` all correctly redirect unauthenticated visitors to `/login`

### 🟡 Built, needs a live Supabase project + a real `ANTHROPIC_API_KEY` to verify end-to-end

- Everything above that touches the database or calls the AI — form submissions, RLS enforcement on the new tables, actual caption generation quality, the revision-flow counter behavior in practice, notification delivery.

### ⬜ Not started (explicitly out of Phase 2 scope)

- Actual publishing to Facebook/Instagram/YouTube (Phase 4/Buffer) — planner content's realistic ceiling is `scheduled`, not `published`
- Background/cron-based Autopilot (generation is on-demand today; needs a hosting decision — spec §37.3 still open)
- AI image/video generation (spec §15/§16 — separately priced, later)
- OAuth "Connect Account" for Facebook/Instagram/YouTube/GBP (Phase 4) — `/app/links` covers manual URL + health check only
- SEO/Search Console/Analytics/reporting (Phase 3)
- Reports module, `content_approvals` as a dedicated table (folded into `content_items`/`content_versions` for now — revisit if reporting needs it)
- Client-side resubmission flow for rejected/more-docs-required verification (still a known Phase 1 gap, unchanged)
- Email receipts (spec §20) — in-app notifications only so far

### 🔴 Blocked

- None currently.

### ⚠️ Needs external setup / verification (owner action required)

- Run migrations `0005`–`0007` against the same Supabase project as Phase 1 (`supabase/README.md`)
- Get an Anthropic API key (console.anthropic.com) and set `ANTHROPIC_API_KEY`
- With real data: generate content in both control modes, confirm the words-to-avoid policy check actually holds back an Autopilot item, confirm the 3-regeneration-then-suggestion gate behaves as expected, confirm two test orgs' Brand Brain/planner data stay isolated (RLS)
- Decide whether the provisional `MONTHLY_AI_GENERATION_SAFETY_CAP` (60/month) is the right number once real usage/cost data exists
