# Digital Command — API Integrations

Three integrations are live (Anthropic API since Phase 2; Google Search Console + Analytics since Phase 3); everything else below is planned. This inventories what's coming and where the seam will be, per spec §13/§39's modularity requirement.

## Integrated

| Integration | Used for | Since | Notes |
|---|---|---|---|
| Anthropic API (`@anthropic-ai/sdk`) | 7-Day Planner caption/hashtag generation; Phase 3 report narratives | Phase 2 | Server-only `ANTHROPIC_API_KEY`, model `claude-haiku-4-5-20251001` (cost-appropriate for short high-volume text, per spec §30/§32's cost-control emphasis). `lib/ai/generate-content.ts` + `lib/ai/generate-report.ts`, sharing `lib/ai/client.ts`. A monthly per-org safety cap (`MONTHLY_AI_GENERATION_SAFETY_CAP`) guards captions against unbounded spend — report generation doesn't have one yet (see `SECURITY_AND_RLS.md`). |
| Google Search Console API | Real indexing/impressions/CTR/position data + keyword tracking | Phase 3 | Real OAuth (`lib/google/oauth.ts`), plain REST calls (`lib/google/search-console.ts`), no `googleapis` SDK. **Needs the user's own Google Cloud OAuth app** (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) — I cannot create this on their behalf. Sensitive-scope, so only Google accounts added as Test Users can connect until the app passes Google's verification review (open item §37.13) — a real, potentially days-to-weeks external timeline. |
| Google Analytics Data API (GA4) | Sessions/users/conversions/top pages | Phase 3 | Same OAuth app and verification caveat as Search Console (`lib/google/analytics.ts`). |

## Planned

| Integration | Used for | Planned phase | Seam |
|---|---|---|---|
| Buffer | Organic social scheduling/publishing | 4 | `Social Publishing Adapter` interface — Digital Command stays the "brain" (planner, approvals, audit); Buffer is one pluggable backend |
| Facebook / Instagram Graph API | Direct publishing where Buffer is insufficient, deeper analytics | 4 | Same adapter |
| YouTube Data API | Upload, metadata, Shorts, analytics | 4 | Direct API (Buffer doesn't cover full YouTube management per spec §13) |
| Google Business Profile | Posts, review monitoring/response, local visibility | 4 | OAuth, client remains account owner |
| Competitor/keyword rank-tracking provider (e.g. Semrush) | Competitor tracking (spec §9.1) | Deferred — explicit user decision | Not started by design: starting a new paid vendor relationship needs the user's sign-off first (spec §36); keyword tracking itself is already covered for free via Search Console (see Integrated, above) |
| AI image generation provider | Content asset generation | Later (§15) | Client's own connected account via OAuth where supported; no password collection — planner media stays manual-upload-only until then |
| KYC/PAN/Aadhaar verification provider | Automated identity verification | Open item §37.1/§37.2 | Currently: human Super Admin review of uploaded documents only |
| Transactional email provider | Registration/approval/report receipts (§20) | Later (§37.4) | Not wired up — audit log + in-app notifications are the record for now |

## Design constraint carried into the schema

Spec §25's generic `api_connections` table exists now, scoped specifically to what's real (`google_connections`) rather than a speculative catch-all — it may need reshaping once Phase 4 adds OAuth-token-shaped *and* long-lived-API-key-shaped connections side by side. `api_health_events` (spec §25) is still **not created** — `google_connections.status` covers today's single connection type; a dedicated events/incident table (feeding spec §27's `Connection Health Center` — `Healthy`/`Warning`/`Reconnect Required`/`Error`/`Rate Limited`) is worth adding once there's more than one connection type to monitor.
