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
| `client_settings` | Created automatically on activation | `automation_status`, `master_stop` |
| `audit_logs` | Append-only action trail | `source` (`AUTOPILOT`\|`CLIENT_MANUAL`\|`ADMIN`\|`GPT_ASSISTANT`), `previous_state`/`new_state` jsonb |

## Triggers / functions

- `handle_new_user()` — inserts a `profiles` row (`role = 'client_owner'`) whenever a new `auth.users` row is created.
- `handle_org_activation()` — when `organizations.status` transitions to `active`: creates `client_settings` and activates + dates the org's latest `subscriptions` row (start = today, expiry = today + 3/6/12 months by billing term).
- `is_super_admin()`, `is_org_member(org_id)` — `security definer` helper functions used throughout RLS policies (see `SECURITY_AND_RLS.md`).

## Storage buckets

- `verification-documents` (private)
- `payment-screenshots` (private)

Both use the path convention `{org_id}/{uuid}-{filename}` so a single `storage.foldername(name)[1]` policy check scopes access per organization.

## Tables from the spec's full list (§25) NOT yet created

`websites`, `social_connections`, `brand_profiles`, `content_items`, `content_versions`, `content_approvals`, `automation_jobs`, `seo_metrics`, `keyword_metrics`, `backlink_opportunities`, `outreach_jobs`, `reports`, `report_metrics`, `notifications`, `api_connections`, `api_health_events`, `support_tickets`, `generated_assets` — these belong to Phase 2+ and are deliberately absent so Phase 1's schema doesn't imply functionality that doesn't exist yet.
