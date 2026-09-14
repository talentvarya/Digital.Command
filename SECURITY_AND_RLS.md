# Digital Command — Security & RLS

## Principle

Authorization lives in Postgres RLS, not in application code. Server actions run under the **calling user's own session** (the anon key + their JWT), so even a bug in a server action can't let a client see or modify another organization's data — Postgres itself refuses the query. The `SUPABASE_SERVICE_ROLE_KEY` is provisioned for future admin/backfill tooling but is **not used by any Phase 1 or Phase 2 mutation**. The new `ANTHROPIC_API_KEY` (Phase 2) is likewise server-only, read exclusively inside `lib/ai/generate-content.ts`, never sent to the browser.

## Role model

- `super_admin` — full access to everything (`is_super_admin()` helper).
- `client_owner` — the registering user; full access to their own org's rows via `is_org_member(org_id)`.
- `client_user` / `client_viewer` — schema-ready (`organization_members.member_role`) but no UI exists yet to invite them (Phase 2+).

There is **no self-serve path to `super_admin`** — every new signup becomes `client_owner` via the `handle_new_user` trigger; a Super Admin is provisioned by hand (see `supabase/README.md`) and column-level grants (`revoke update on profiles from authenticated; grant update (full_name, updated_at) ...`) stop a client from ever setting their own `role` even if they tampered with a request.

## RLS policy matrix (see `supabase/migrations/0002_rls.sql` for the exact SQL)

| Table | Client (org member) | Super Admin |
|---|---|---|
| `profiles` | SELECT/UPDATE own row (role column not grantable) | SELECT/UPDATE all |
| `organizations` | SELECT own org; UPDATE only while `draft → draft/pending_approval` | SELECT/UPDATE all (activation, rejection, pause) |
| `organization_members` | SELECT own org's members; INSERT self as `owner` of an org they created | Full access |
| `plans`, `policy_versions` | SELECT (public pricing/legal text) | Full access |
| `subscriptions` | SELECT own; INSERT with `status='pending'` only | UPDATE (activation dates, status) |
| `consent_records` | SELECT own org; INSERT own (`user_id = auth.uid()`) | SELECT all — **no UPDATE/DELETE for anyone** |
| `business_verifications` | SELECT/INSERT own; UPDATE only `draft/more_documents_required → submitted` | UPDATE to any status (approve/reject/request docs) |
| `verification_documents` | SELECT/INSERT own — **no UPDATE/DELETE for anyone** | SELECT all |
| `payments` | SELECT/INSERT own (`status='pending_verification'` only) | UPDATE (verify/reject) |
| `client_settings` | SELECT own | UPDATE (created only by the activation trigger) |
| `audit_logs` | SELECT own org; INSERT own actions — **no UPDATE/DELETE for anyone** | SELECT all |

Append-only tables (`audit_logs`, `consent_records`, `verification_documents`, `content_versions`) have **no UPDATE/DELETE policy at all** — not "restricted", genuinely absent, so Postgres denies by default regardless of role tampering.

### Phase 2 additions (`supabase/migrations/0006_phase2_rls.sql`)

| Table | Client (org member) | Super Admin |
|---|---|---|
| `brand_profiles`, `org_links` | Full CRUD on their own org's rows — this is the client's own creative/config data | SELECT only (support visibility, no editing control) |
| `content_items` | Full CRUD; DELETE additionally requires `locked = false` at the RLS layer (see below) | SELECT only — approval is the client's call, not admin's |
| `content_media` | INSERT/SELECT/DELETE own | SELECT only |
| `content_versions` | SELECT/INSERT own — **no UPDATE/DELETE for anyone** | SELECT all |
| `notifications` | SELECT own; INSERT own; UPDATE limited to the `read` column (column-level grant, same pattern as `profiles.role`) | SELECT all; INSERT (e.g. activation notices) |

**Locked items and silent no-ops**: `content_items`' DELETE policy checks `locked = false` in `USING`, so Postgres silently deletes 0 rows (no error) if a client tries to delete a locked item via a stale UI state or a direct call. `deleteContentItemAction` explicitly checks the returned row count and surfaces a friendly error instead of reporting false success — worth remembering as a pattern any time an RLS policy adds a conditional beyond plain org-ownership. `locked` is **not** encoded into the UPDATE policy (only app-layer checks in each action) because an update-side lock check would also block the unlock action itself; a `locked` UPDATE-blocking policy is a UX/workflow guard, not a tenant-isolation boundary, so it stays at the application layer deliberately.

## Storage

All four buckets (`verification-documents`, `payment-screenshots`, `brand-assets`, `content-media`) are private. Policies check `is_org_member((storage.foldername(name))[1]::uuid)` or `is_super_admin()` against the `{org_id}/...` path prefix, mirroring the owning table's access rules. Signed URLs (short-lived, generated server-side) are used to display documents/media — nothing is ever public.

## MFA

Super Admin accounts must enroll TOTP (Supabase Auth's native MFA — no third-party service) before reaching any `/admin/*` page other than `/admin/mfa-setup` itself; enforced in `middleware.ts` via `supabase.auth.mfa.listFactors()`.

## Secrets

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe for the browser (RLS is what actually protects data, not key secrecy).
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, currently unused by app code; reserved for future admin tooling. Never imported into a Client Component.

## What's still not covered

- Rate limiting, login-history UI, suspicious-activity alerts (spec §26) — infra-level concerns better handled by Supabase's own auth rate limits initially; a dedicated implementation is a later-phase item.
- Real KYC/Aadhaar verification — documents are stored and reviewed by a human, not verified against a government API.
- AI generation has no per-client rate limit or cost cap yet (spec §30/§32 flags this as a real risk — "do not allow a plan to silently become loss-making"). Haiku is cheap, but a client mashing "Generate Another" has no ceiling today. Worth a fair-use limit before onboarding paying clients.
