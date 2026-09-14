# Digital Command — API Integrations

None are wired up in Phase 1. This inventories what's planned and where the seam will be, per spec §13/§39's modularity requirement.

| Integration | Used for | Planned phase | Seam |
|---|---|---|---|
| Buffer | Organic social scheduling/publishing | 4 | `Social Publishing Adapter` interface — Digital Command stays the "brain" (planner, approvals, audit); Buffer is one pluggable backend |
| Facebook / Instagram Graph API | Direct publishing where Buffer is insufficient, deeper analytics | 4 | Same adapter |
| YouTube Data API | Upload, metadata, Shorts, analytics | 4 | Direct API (Buffer doesn't cover full YouTube management per spec §13) |
| Google Search Console | Indexing, impressions, CTR, position data | 3 | Read-only reporting integration |
| Google Analytics | Traffic, conversions | 3 | Read-only reporting integration |
| Google Business Profile | Posts, review monitoring/response, local visibility | 4 | OAuth, client remains account owner |
| AI image generation provider | Content asset generation | Later (§15) | Client's own connected account via OAuth where supported; no password collection |
| KYC/PAN/Aadhaar verification provider | Automated identity verification | Open item §37.1/§37.2 | Currently: human Super Admin review of uploaded documents only |
| Transactional email provider | Registration/approval/report receipts (§20) | Later (§37.4) | Not wired up — audit log is the authoritative record for Phase 1 |

## Design constraint carried into Phase 1's schema

`api_connections` and `api_health_events` (spec §25) are **not created yet** — adding empty tables for integrations that don't exist would misrepresent what's built. They'll be added in the phase that actually implements the first real connection, at which point `Connection Health Center` (spec §27) statuses (`Healthy`/`Warning`/`Reconnect Required`/`Error`/`Rate Limited`) get a real backing table.
