# Digital Command — API Integrations

Five integrations are live (Anthropic API since Phase 2; Google Search Console + Analytics since Phase 3; Buffer + YouTube since Phase 4); everything else below is planned. This inventories what's coming and where the seam will be, per spec §13/§39's modularity requirement.

## Integrated

| Integration | Used for | Since | Notes |
|---|---|---|---|
| Anthropic API (`@anthropic-ai/sdk`) | 7-Day Planner caption/hashtag generation; Phase 3 report narratives | Phase 2 | Server-only `ANTHROPIC_API_KEY`, model `claude-haiku-4-5-20251001` (cost-appropriate for short high-volume text, per spec §30/§32's cost-control emphasis). `lib/ai/generate-content.ts` + `lib/ai/generate-report.ts`, sharing `lib/ai/client.ts`. A monthly per-org safety cap (`MONTHLY_AI_GENERATION_SAFETY_CAP`) guards captions against unbounded spend — report generation doesn't have one yet (see `SECURITY_AND_RLS.md`). |
| Google Search Console API | Real indexing/impressions/CTR/position data + keyword tracking | Phase 3 | Real OAuth (`lib/google/oauth.ts`), plain REST calls (`lib/google/search-console.ts`), no `googleapis` SDK. **Needs the user's own Google Cloud OAuth app** (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) — I cannot create this on their behalf. Sensitive-scope, so only Google accounts added as Test Users can connect until the app passes Google's verification review (open item §37.13) — a real, potentially days-to-weeks external timeline. |
| Google Analytics Data API (GA4) | Sessions/users/conversions/top pages | Phase 3 | Same OAuth app and verification caveat as Search Console (`lib/google/analytics.ts`). |
| Buffer GraphQL API | Facebook/Instagram publishing (spec §13) | Phase 4 | **Not per-client OAuth** — Buffer's current API only supports a personal key tied to one Buffer login (verified directly against developers.buffer.com before building; the per-client-OAuth model the spec seems to assume isn't available as of 2026). `BUFFER_ACCESS_TOKEN` is VMG's own key; `lib/buffer/client.ts`. Each client's channel is added to VMG's one Buffer account on buffer.com, then linked to the right org from the admin panel (`buffer_channel_links`). Full reasoning in `ARCHITECTURE.md`. |
| YouTube Data API v3 | Video upload, metadata, scheduled publish | Phase 4 | Direct API (spec §13 explicitly names full YouTube management as a Buffer-insufficient case), reusing the Phase 3 Google OAuth app with a third `service` value. Multipart upload (`lib/youtube/client.ts`) — large videos may hit serverless limits depending on the still-open hosting choice (spec §37.3). |

## Planned

| Integration | Used for | Planned phase | Seam |
|---|---|---|---|
| Facebook / Instagram Graph API (direct) | Fallback if Buffer's beta API proves unstable, or deeper analytics Buffer doesn't expose | Not scheduled | The adapter (`lib/publishing/dispatch.ts`) already isolates the Buffer call behind a function boundary — adding a direct-API branch later doesn't touch the planner code that calls it |
| Google Business Profile | Posts, review monitoring/response, local visibility | Deferred — see below | OAuth, client remains account owner |
| Competitor/keyword rank-tracking provider (e.g. Semrush) | Competitor tracking (spec §9.1) | Deferred — explicit user decision | Not started by design: starting a new paid vendor relationship needs the user's sign-off first (spec §36); keyword tracking itself is already covered for free via Search Console (see Integrated, above) |
| AI image generation provider | Content asset generation | Later (§15) | Client's own connected account via OAuth where supported; no password collection — planner media stays manual-upload-only until then |
| KYC/PAN/Aadhaar verification provider | Automated identity verification | Open item §37.1/§37.2 | Currently: human Super Admin review of uploaded documents only |
| Transactional email provider | Registration/approval/report receipts (§20) | Later (§37.4) | Not wired up — audit log + in-app notifications are the record for now |

**Google Business Profile specifically**: checked before scoping it out of Phase 4 — GBP API access requires a separate formal access-request form, a Business Profile verified and **active for 60+ days**, a business website, and a Google review (days to weeks, rejections common for thin applications); quota is 0 QPM until approved, so unlike Search Console there's no Test-User workaround to even develop against it. Revisit once the user has an eligible profile and wants to start that process.

## Design constraint carried into the schema

Spec §25's generic `api_connections` table now has two real, differently-shaped instances rather than one speculative catch-all: `google_connections` (per-org OAuth tokens, client-managed) and `buffer_channel_links` (one shared account's channel IDs, admin-managed) — the Phase 3 prediction that this would need reshaping for Phase 4's different credential shapes turned out right. `api_health_events` (spec §25) is still **not created** — each connection table's own `status` column covers today's need; a dedicated events/incident table (feeding spec §27's `Connection Health Center` — `Healthy`/`Warning`/`Reconnect Required`/`Error`/`Rate Limited`) is worth adding once there's enough connection volume to justify it.
