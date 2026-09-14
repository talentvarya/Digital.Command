# Digital Command — Database Schema

Full SQL lives in `supabase/migrations/`. This is the human-readable map.

`0018_fix_org_select_on_create.sql` (post-Phase 7) fixes a real bug found during the first live-database verification pass: `organizations_select`'s RLS policy blocked a user from seeing the org they had just created (no `organization_members` row exists yet at that exact moment), which broke registration's `INSERT ... RETURNING` for everyone, always, since Phase 1. Full diagnosis in `SECURITY_AND_RLS.md`, context in `PROJECT_PLAN.md`'s "Live database verification" section.

`0019_ai_provider_tracking.sql` (post-Phase 7) adds `ai_usage_events.provider` (`anthropic`\|`kimi`, default `anthropic`) so per-call cost tracking stays accurate once Kimi is a second, switchable AI provider alongside Claude — see `ARCHITECTURE.md`'s "AI Provider Abstraction" section.

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
| `google_connections` | OAuth state for Search Console/Analytics/YouTube | `service` (`search_console`\|`analytics`\|`youtube`, third value added Phase 4), `external_property`, `access_token`/`refresh_token` (server-only, never in a client-rendered query), `status`, `last_synced_at` — unique per `(org_id, service)` |
| `seo_audits` | Technical crawl-audit results | `url`, `score` (0–100), `issues` (jsonb array of `{severity, type, message}`), `crawled_at` |
| `search_console_snapshots` | One row per sync — also the keyword-tracking data source | `site_url`, `total_clicks`/`total_impressions`/`avg_ctr`/`avg_position`, `top_queries`/`top_pages` (jsonb) |
| `analytics_snapshots` | One row per sync | `property_id`, `sessions`/`users`/`conversions`, `top_pages` (jsonb) |
| `reports` | Generated on demand (spec §21) | `period_start`/`period_end`, `metrics_snapshot` (jsonb — the real numbers), `summary_text`/`next_plan_text` (AI-written, only from those numbers) |

`seo_audits`, `search_console_snapshots`, `analytics_snapshots`, and `reports` are all **append-only by design** — each audit/sync/report creates a new row rather than updating an old one, which is what makes period-over-period trend comparisons possible. `google_connections` is the one Phase 3 table that does get updated in place (token refresh, property selection) and deleted (disconnect).

## Tables/columns added in Phase 4

| Table | Purpose | Key columns |
|---|---|---|
| `buffer_channel_links` | Admin-managed mapping from an org+platform to one of **VMG's own** Buffer channels (see `ARCHITECTURE.md`: Buffer's current API doesn't support per-client OAuth) | `org_id`, `platform` (`facebook`\|`instagram`), `buffer_channel_id`, `buffer_channel_name`, `linked_by` — unique per `(org_id, platform)` |

`content_items` gained four columns: `buffer_post_id`, `youtube_video_id`, `publish_status` (`not_sent`\|`sent`\|`error`, default `not_sent`), `publish_error`. `status = 'published'` was already in the enum since Phase 2 but was unreachable until Phase 4's publish-dispatch + status-confirmation loop could actually get a `content_item` there for real.

Unlike every Phase 1–3 connection table (client-managed via `is_org_member`), `buffer_channel_links` is **admin-managed** — clients get read-only visibility, only Super Admin can link/unlink a channel. This isn't an oversight; it follows directly from the Buffer account itself being VMG's, not the client's (see `ARCHITECTURE.md` and `SECURITY_AND_RLS.md`).

## Tables created in Phase 5

| Table | Purpose | Key columns |
|---|---|---|
| `off_page_opportunities` | A candidate URL the client/admin found, plus its AI assessment (spec §9.2) | `url`, `opportunity_type` (`guest_contribution`\|`broken_link`\|`unlinked_mention`\|`other`), `status` (`new`→`assessed`→`contacted`→`awaiting_response`→`link_acquired`\|`declined`\|`lost`), `relevance_score`/`quality_notes`/`spam_risk` (AI), `contact_email`/`contact_name`, `link_verified`/`link_last_checked_at`/`link_first_confirmed_at` |
| `outreach_messages` | AI-drafted, one-at-a-time outreach/follow-up messages | `opportunity_id`, `subject`, `body`, `status` (`draft`\|`sent`), `sent_at`, `follow_up_due_at`, `generated_by` |
| `brand_mention_searches` | Append-only snapshot of a Custom Search query for the brand name | `query`, `searched_at`, `results` (jsonb array of `{title, link, snippet}`) |

`off_page_opportunities` and `outreach_messages` are client-managed (full CRUD via `is_org_member`) — this is the client's own business-development work, same ownership model as `brand_profiles`/`content_items`, unlike Phase 4's admin-managed `buffer_channel_links`. `brand_mention_searches` is append-only (insert/select only), same convention as every other `*_snapshots` table.

## Tables created in Phase 6

| Table | Purpose | Key columns |
|---|---|---|
| `paid_campaigns` | Paid ad campaign preparation + lifecycle (spec §14) | `platform` (`google_ads`\|`meta_facebook`\|`meta_instagram`\|`youtube_ads`\|`other`), `audience_description`/`keywords`/`creative_brief` (AI-drafted, client-editable), `suggested_budget_notes` (AI, qualitative-only, never authoritative), `max_spend`/`budget_period`/`start_date`/`end_date` (client-set — the actual spend authorization), `status` (`draft`→`pending_approval`→`approved`\|`rejected`→`launched_externally`→`paused`\|`completed`\|`cancelled`), `external_campaign_id`/`external_platform_status`/`spend_to_date`/`clicks`/`conversions` (admin-entered, post-launch only), `launched_by`/`launched_at`, `performance_updated_by`/`performance_updated_at` |
| `paid_campaign_approvals` | Append-only — one row per approval/rejection **decision**, not per campaign (spec §14's explicit field list) | `campaign_id`, `decision` (`approved`\|`rejected`), `reason` (rejection), `approval_version` (increments per campaign), a snapshot of `max_spend`/`budget_period`/`start_date`/`end_date` as approved (immutable proof even if the campaign row changes later), `approved_by`, `ip_address`, `user_agent` |

`paid_campaigns.status` is the one place in this schema where a client-set value (`draft`/`pending_approval`/`approved`/`rejected`) and an admin-set value (`launched_externally`/`paused`/`completed`/`cancelled`) share a single column — RLS gives both roles an UPDATE policy, but only the *client's own* server action (`approveCampaignAction`) ever writes `approved`, and only the *admin's* actions ever write the post-launch values (enforced in `app/admin/clients/[orgId]/paid-campaign-actions.ts`'s status allowlist). See `SECURITY_AND_RLS.md`.

## Tables/columns added in Phase 7

| Table | Purpose | Key columns |
|---|---|---|
| `system_settings` | Single-row platform-wide switch (Emergency Freeze, spec §28) | `id` (boolean PK, `check(id)` — enforces exactly one row), `emergency_freeze`, `frozen_by`/`frozen_at`/`frozen_reason` |
| `ai_usage_events` | Append-only, real per-call AI token/cost tracking (spec §30) | `feature` (`content_generation`\|`report_narrative`\|`opportunity_assessment`\|`outreach_draft`\|`campaign_brief`\|`assistant_chat`), `provider` (`anthropic`\|`kimi`, default `anthropic` — added `0019_ai_provider_tracking.sql`), `input_tokens`/`output_tokens`, `estimated_cost_usd` — **the one append-only table where the owning org gets no SELECT at all** (see `SECURITY_AND_RLS.md`) |
| `conversion_links` | Client-created trackable link (spec §22) | `type` (`whatsapp`\|`phone`\|`form`\|`booking`\|`other`), `label`, `destination` |
| `conversion_events` | Append-only click/lead/sale/booking log | `link_id` (nullable — null means manually logged, not from a tracked link), `event_type`, `value`, `utm_source`/`utm_medium`/`utm_campaign` — `org_id` is derived server-side from `link_id` by a trigger whenever a link is involved, never trusted from a public request |

`client_settings` gained 4 nullable manual-cost columns (`manual_buffer_cost_usd`, `manual_storage_cost_usd`, `manual_other_cost_usd`, `manual_other_cost_label`, spec §30) — no API exists to pull these for real, so they're admin-entered.

`content_versions.generated_by` CHECK extended to add `'gpt_assistant'` (the AI Assistant, spec §17) and `'restored'` (version-restore, spec §24); gained a nullable `restored_from_version int` for the restore breadcrumb.

`organizations` gained `is_sandbox boolean` (spec §31) and its `status` CHECK was extended to add `'offboarded'` (spec §29) — same drop/add-constraint pattern already used for `google_connections.service` in Phase 4.

**Two pre-existing bugs fixed in `0016_phase7_schema.sql`, not new features** (full story in `PROJECT_PLAN.md`'s Phase 7 section): `client_settings.master_stop`'s default flipped from `true` to `false` (it had defaulted to "stopped" since Phase 1, undetected because nothing read it until now) with a backfill update; and the missing `client_settings` owner-UPDATE RLS policy (Phase 2's Autopilot/Approval-Required toggle had been silently failing) is fixed in `0017_phase7_rls.sql`.

## Triggers / functions

- `handle_new_user()` — inserts a `profiles` row (`role = 'client_owner'`) whenever a new `auth.users` row is created.
- `handle_org_activation()` — when `organizations.status` transitions to `active`: creates `client_settings` and activates + dates the org's latest `subscriptions` row (start = today, expiry = today + 3/6/12 months by billing term).
- `is_super_admin()`, `is_org_member(org_id)` — `security definer` helper functions used throughout RLS policies (see `SECURITY_AND_RLS.md`).
- `set_conversion_event_org_id()` (Phase 7) — `before insert` trigger on `conversion_events` that derives `org_id` from `link_id` whenever a link is involved, so the public/anon click-insert path (`0017_phase7_rls.sql`) never has to trust a request's own claim about which org a click belongs to.

## Storage buckets

- `verification-documents` (private) — Phase 1
- `payment-screenshots` (private) — Phase 1
- `brand-assets` (private) — Phase 2, logo uploads
- `content-media` (private) — Phase 2, planner images/videos

All four use the path convention `{org_id}/{uuid}-{filename}` so a single `storage.foldername(name)[1]` policy check scopes access per organization. Phase 3 added no new buckets — Google data is API-fetched, not file-stored.

## Tables from the spec's full list (§25) NOT yet created

`websites`, `social_connections` (spec's generic name for publishing connections — turned out to need two differently-shaped real tables, `google_connections` and `buffer_channel_links`, rather than one), `content_approvals` (folded into `content_items.status` + `content_versions` history rather than a separate table), `automation_jobs`, `seo_metrics`/`keyword_metrics` (folded into `seo_audits`/`search_console_snapshots` rather than finer-grained per-day tables — revisit if trend reporting needs daily granularity), `report_metrics` (folded into `reports.metrics_snapshot` jsonb), `api_health_events`, `support_tickets`, `generated_assets` — these belong to Phase 6+ and are deliberately absent so the schema doesn't imply functionality that doesn't exist yet.

Spec §25's `backlink_opportunities` and `outreach_jobs` are **partially** represented: `off_page_opportunities`/`outreach_messages` (Phase 5) cover the human-seeded, AI-assessed pipeline described in `ARCHITECTURE.md`, but not a web-wide automated discovery engine — that needs a backlink index (Ahrefs/Semrush/Moz-class), explicitly deferred (see `PROJECT_PLAN.md`'s Phase 5 section).

Spec §25's `ad_campaigns`/`campaign_approvals` are now **fully** represented as `paid_campaigns`/`paid_campaign_approvals` (Phase 6) — the one gap from this table's original NOT-yet-created list that Phase 6 closes.

Phase 7 deliberately does **not** create `api_health_events` — the Connection Health Center (spec §27) turned out to need zero new schema at all, since it's pure aggregation over status columns (`org_links.status`, `google_connections.status`, `buffer_channel_links` presence) that already existed; a dedicated events/incident table is still worth adding once there's real connection volume and, ideally, a cron platform to poll it proactively (still gated on the open hosting decision, spec §37.3). `automation_jobs`, `support_tickets`, `generated_assets` remain not yet created — none of Phase 7's 8 sub-features needed them.
