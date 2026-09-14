# Digital Command — Database Schema

Full SQL lives in `supabase/migrations/`. This is the human-readable map.

## Tables created in Phase 1

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | 1:1 with `auth.users`, created by trigger `handle_new_user` on signup | `id`, `role` (`super_admin`\|`client_owner`\|`client_user`\|`client_viewer`) |
| `organizations` | One row per registered business | `status` (`draft`→`pending_approval`→`active`\|`paused`\|`expired`\|`rejected`), `created_by` |
| `organization_members` | User↔org membership (multi-user ready) | `member_role` (`owner`\|`user`\|`viewer`) |
| `plans` | Seeded package catalog | `code` (`package_a`\|`package_b`\|`custom`), pricing per billing term |
| `subscriptions` | An org's active plan + term | `status`, `start_date`, `expiry_date` (computed by activation trigger) |
| `policy_versions` | Versioned legal/consent text | `policy_type`, `version`, `is_current` |
| `consent_records` | Immutable proof of acceptance | `org_id`, `user_id`, `policy_version_id`, `ip_address`, `user_agent` |
| `business_verifications` | KYC/verification workflow state | `status`, `details` (jsonb — CIN, registered office, etc.), `reviewed_by`/`reason` |
| `verification_documents` | Uploaded doc metadata (files live in Storage) | `doc_type`, `storage_path` |
| `payments` | Manual payment submission + review | `status` (`pending_verification`\|`verified`\|`rejected`) |
| `client_settings` | Created automatically on activation | `automation_status`, `master_stop`, + Phase 2: `content_control_mode`, `approval_then_autopilot`, `autopilot_since` |
| `audit_logs` | Append-only action trail | `source` (`AUTOPILOT`\|`CLIENT_MANUAL`\|`ADMIN`\|`GPT_ASSISTANT`), `previous_state`/`new_state` jsonb |

## Tables created in Phase 2

| Table | Purpose | Key columns |
|---|---|---|
| `brand_profiles` | One row per org — every spec §18 field | `org_id` (pk), `colors`/`fonts`/`words_to_avoid`/`competitors` (jsonb arrays), `preferred_tone`, `cta_style`, `logo_path` |
| `org_links` | Manual URL registry for websites/channels (spec §12's non-OAuth half) | `link_type`, `url`, `status` (`connected`\|`not_added`\|`reconnect_required`\|`error`), `last_checked_at`/`last_check_result` |
| `content_items` | 7-Day Planner slots (spec §11) | `platform`, `scheduled_date`, `status` (`draft`→`waiting_approval`\|`scheduled`→…), `source`, `control_mode` snapshot, `locked`, `rejection_count` (= generation-attempt counter) |
| `content_media` | One row per image/video attached to a content item | `media_type`, `storage_path` |
| `content_versions` | Append-only AI-generation/edit history per item | `version_number`, `generated_by` (`ai`\|`client_suggestion`\|`client_edit`\|`admin`), `client_suggestion_text` |
| `notifications` | In-app notices (email still deferred) | `org_id`, `user_id` (null = org-wide), `type`, `read` |

`client_settings.content_control_mode` (`autopilot`\|`approval_required`, default `approval_required`) drives whether AI-generated content auto-schedules or waits for client approval — see `ARCHITECTURE.md`'s "AI content generation" section.

## Tables created in Phase 3

| Table | Purpose | Key columns |
|---|---|---|
| `google_connections` | OAuth state for Search Console/Analytics | `service` (`search_console`\|`analytics`), `external_property`, `access_token`/`refresh_token` (server-only, never in a client-rendered query), `status`, `last_synced_at` — unique per `(org_id, service)` |
| `seo_audits` | Technical crawl-audit results | `url`, `score` (0–100), `issues` (jsonb array of `{severity, type, message}`), `crawled_at` |
| `search_console_snapshots` | One row per sync — also the keyword-tracking data source | `site_url`, `total_clicks`/`total_impressions`/`avg_ctr`/`avg_position`, `top_queries`/`top_pages` (jsonb) |
| `analytics_snapshots` | One row per sync | `property_id`, `sessions`/`users`/`conversions`, `top_pages` (jsonb) |
| `reports` | Generated on demand (spec §21) | `period_start`/`period_end`, `metrics_snapshot` (jsonb — the real numbers), `summary_text`/`next_plan_text` (AI-written, only from those numbers) |

`seo_audits`, `search_console_snapshots`, `analytics_snapshots`, and `reports` are all **append-only by design** — each audit/sync/report creates a new row rather than updating an old one, which is what makes period-over-period trend comparisons possible. `google_connections` is the one Phase 3 table that does get updated in place (token refresh, property selection) and deleted (disconnect).

## Triggers / functions

- `handle_new_user()` — inserts a `profiles` row (`role = 'client_owner'`) whenever a new `auth.users` row is created.
- `handle_org_activation()` — when `organizations.status` transitions to `active`: creates `client_settings` and activates + dates the org's latest `subscriptions` row (start = today, expiry = today + 3/6/12 months by billing term).
- `is_super_admin()`, `is_org_member(org_id)` — `security definer` helper functions used throughout RLS policies (see `SECURITY_AND_RLS.md`).

## Storage buckets

- `verification-documents` (private) — Phase 1
- `payment-screenshots` (private) — Phase 1
- `brand-assets` (private) — Phase 2, logo uploads
- `content-media` (private) — Phase 2, planner images/videos

All four use the path convention `{org_id}/{uuid}-{filename}` so a single `storage.foldername(name)[1]` policy check scopes access per organization. Phase 3 added no new buckets — Google data is API-fetched, not file-stored.

## Tables from the spec's full list (§25) NOT yet created

`websites`, `social_connections` (OAuth-authenticated *publishing* connections for Phase 4 — a different shape than `google_connections`, which is read-only reporting access), `content_approvals` (folded into `content_items.status` + `content_versions` history rather than a separate table), `automation_jobs`, `seo_metrics`/`keyword_metrics` (folded into `seo_audits`/`search_console_snapshots` rather than finer-grained per-day tables — revisit if trend reporting needs daily granularity), `backlink_opportunities`, `outreach_jobs`, `report_metrics` (folded into `reports.metrics_snapshot` jsonb), `api_health_events`, `support_tickets`, `generated_assets` — these belong to Phase 4+ and are deliberately absent so the schema doesn't imply functionality that doesn't exist yet.
