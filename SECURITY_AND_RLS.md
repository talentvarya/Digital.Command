# Digital Command — Security & RLS

## Principle

Authorization lives in Postgres RLS, not in application code. Server actions run under the **calling user's own session** (the anon key + their JWT), so even a bug in a server action can't let a client see or modify another organization's data — Postgres itself refuses the query. The `SUPABASE_SERVICE_ROLE_KEY` is provisioned for future admin/backfill tooling but is **not used by any Phase 1–4 mutation**. `ANTHROPIC_API_KEY` (Phase 2), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (Phase 3), and `BUFFER_ACCESS_TOKEN` (Phase 4) are likewise server-only secrets, read exclusively inside `lib/ai/`, `lib/google/oauth.ts`, and `lib/buffer/client.ts` respectively, never sent to the browser.

`buffer_channel_links` (Phase 4) is a deliberate exception to "client owns their own org's data": it's **admin-managed**, not client-managed, because the underlying Buffer account is VMG's, not the client's (see the Phase 4 RLS section below and `ARCHITECTURE.md`'s "Publishing dispatch"). Every other per-org table in this app follows the client-owns-their-data pattern; don't copy this one as a default for something new without the same reasoning applying.

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

### Phase 3 additions (`supabase/migrations/0009_phase3_rls.sql`)

| Table | Client (org member) | Super Admin |
|---|---|---|
| `google_connections` | Full CRUD on their own org's rows (connect/sync/disconnect) | SELECT only |
| `seo_audits`, `search_console_snapshots`, `analytics_snapshots`, `reports` | SELECT/INSERT own — **no UPDATE/DELETE for anyone** (append-only, same convention as `audit_logs`/`content_versions`) | SELECT all |

**`google_connections` token handling is an application-layer discipline, not an extra RLS rule.** RLS controls *who* can read a row at all (the org's own members, plus Super Admin) — it does not restrict *which columns* a given `select()` call projects. `access_token`/`refresh_token` could technically be selected by an org member's own browser client, since they're a legitimate member of that row's org. The actual protection is that **no code path renders those columns to a Client Component**: `lib/google/oauth.ts`'s `getValidAccessToken()` is the only function that ever reads them, called exclusively from server actions and route handlers; every query used for UI (`/app/seo`'s connection cards) explicitly selects `id, service, external_property, status, last_synced_at` and nothing else. If you add a new query against this table, keep that column list — don't `select('*')` into anything that reaches JSX.

### Phase 4 additions (`supabase/migrations/0011_phase4_rls.sql`)

| Table | Client (org member) | Super Admin |
|---|---|---|
| `buffer_channel_links` | **SELECT only** — read-only visibility of which Buffer channel their org publishes through | Full CRUD (link/unlink a channel from the admin panel) |
| `content_items` (new columns) | Rides the table's existing Phase 2 policies — no new policy needed, same rows | Same |

`buffer_channel_links` inverts the usual client-owns-their-data pattern on purpose: the client has no Buffer credentials to manage here, because there aren't any — the underlying account is VMG's single `BUFFER_ACCESS_TOKEN`. Giving clients SELECT (not just nothing) still matters: they can see which channel their content publishes through without being able to repoint it.

`BUFFER_ACCESS_TOKEN` deserves the same discipline as Google's tokens above, with one simplification: there's only ever one value (not one per org), read exclusively inside `lib/buffer/client.ts`'s `bufferGraphQL()`, never selected from any table (it's an env var, not a DB column) and never sent to the browser.

## Storage

All four buckets (`verification-documents`, `payment-screenshots`, `brand-assets`, `content-media`) are private. Policies check `is_org_member((storage.foldername(name))[1]::uuid)` or `is_super_admin()` against the `{org_id}/...` path prefix, mirroring the owning table's access rules. Signed URLs (short-lived, generated server-side) are used to display documents/media — nothing is ever public.

## MFA

Super Admin accounts must enroll TOTP (Supabase Auth's native MFA — no third-party service) before reaching any `/admin/*` page other than `/admin/mfa-setup` itself; enforced in `middleware.ts` via `supabase.auth.mfa.listFactors()`.

## Google OAuth CSRF protection

`GET /api/google/oauth/start` generates a random nonce, embeds it (plus the target service) in a `state` string, and sets it as an httpOnly, `SameSite=Lax` cookie before redirecting to Google. `GET /api/google/oauth/callback` requires the returned `state` query param to exactly match the cookie value before it will exchange the code — a standard OAuth CSRF defense, not skipped for convenience. The cookie is deleted immediately after the comparison (single use). Covers all three Google services (Search Console, Analytics, YouTube) — one flow, `service` is just part of the state string.

## Secrets

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe for the browser (RLS is what actually protects data, not key secrecy).
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, currently unused by app code; reserved for future admin tooling. Never imported into a Client Component.
- `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — server-only; read only inside `lib/ai/`, `lib/google/oauth.ts`.
- `BUFFER_ACCESS_TOKEN` — server-only; read only inside `lib/buffer/client.ts`. Unlike every other secret above, this is **VMG's own personal credential**, not a platform-level app secret — treat it with the same care as an individual's password, since whoever holds it can post as any client channel added to that Buffer account.

## What's still not covered

- Rate limiting, login-history UI, suspicious-activity alerts (spec §26) — infra-level concerns better handled by Supabase's own auth rate limits initially; a dedicated implementation is a later-phase item.
- Real KYC/Aadhaar verification — documents are stored and reviewed by a human, not verified against a government API.
- AI caption generation has a monthly per-org safety cap (Phase 2, `MONTHLY_AI_GENERATION_SAFETY_CAP`); AI report-narrative generation (Phase 3) and publish-dispatch (Phase 4) do **not** have one yet — worth adding before real client traffic, same reasoning as spec §30/§36.
- Google OAuth tokens are stored as plain columns in Postgres (protected by RLS + the column-discipline above, and Supabase encrypts data at rest) rather than through a dedicated secrets-encryption layer (e.g. `pgsodium`/Vault). Acceptable for this phase given the existing protections; revisit if handling higher-sensitivity scopes later.
- No rate limit or ownership check on `checkPublishStatusAction`/`dispatchToPublisher` beyond normal org-membership — a client could in principle re-check status repeatedly; low real-world risk (Buffer/YouTube's own APIs would rate-limit first) but worth a look before high-volume use.
