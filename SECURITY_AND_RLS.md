# Digital Command — Security & RLS

## Principle

Authorization lives in Postgres RLS, not in application code. Server actions run under the **calling user's own session** (the anon key + their JWT), so even a bug in a server action can't let a client see or modify another organization's data — Postgres itself refuses the query. The `SUPABASE_SERVICE_ROLE_KEY` is provisioned for future admin/backfill tooling but is **not used by any Phase 1–5 mutation**. `ANTHROPIC_API_KEY` (Phase 2), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (Phase 3), `BUFFER_ACCESS_TOKEN` (Phase 4), `GOOGLE_CUSTOM_SEARCH_API_KEY`/`GOOGLE_CUSTOM_SEARCH_ENGINE_ID` (Phase 5), and `MOONSHOT_API_KEY`/`GEMINI_API_KEY`/`OPENAI_API_KEY` (post-Phase 7, all optional — only needed when `AI_PROVIDER` selects that provider) are likewise server-only secrets, read exclusively inside `lib/ai/`, `lib/google/oauth.ts`, `lib/buffer/client.ts`, and `lib/google/custom-search.ts` respectively, never sent to the browser.

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
| `organizations` | SELECT own org **or an org they created** (see note below); UPDATE only while `draft → draft/pending_approval` | SELECT/UPDATE all (activation, rejection, pause) |
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

### `organizations_select` fix (`0018_fix_org_select_on_create.sql`) — found during the first live-database verification pass, blocked every registration

The single most consequential bug found in this whole project, because it blocked the most foundational flow — registration — completely, for every user, in any real deployment, from Phase 1 onward. Never caught because it only manifests under genuine RLS enforcement, which nothing in this codebase's own build/lint/browser-route-guard checks ever exercised.

`completeRegistrationAction` (`app/register/actions.ts`) creates a brand-new org with `.from("organizations").insert({...}).select("id").single()`. Under Postgres RLS, `INSERT ... RETURNING` enforces the table's **SELECT** policy on the row being returned — not just the INSERT policy on the row being written. The original `organizations_select` policy was `is_org_member(id) OR is_super_admin()`, but at the exact moment a new org is inserted, no `organization_members` row exists yet (that's a later step in the same action) — so the very user who just created the org couldn't "see" it for the RETURNING clause, and Postgres surfaced this as `new row violates row-level security policy for table "organizations"` even though the INSERT itself was perfectly valid per `organizations_insert`'s own check.

Diagnosed by: creating a temporary `debug_whoami()` SQL function (`security definer`, returns `auth.uid()`/`auth.jwt()`) and a temporary debug route calling it in the exact same request as a real insert — confirmed `auth.uid()` matched `created_by` exactly, then confirmed the same insert succeeded cleanly with `.select()` removed, isolating the RETURNING-clause SELECT check as the actual cause. Both debug artifacts were removed before this fix was committed.

Fix: `organizations_select` now also allows `created_by = auth.uid()` — a user can always see an org they created, even before any membership row exists. This isn't a new trust concept: `organization_members_insert_self` (`0002_rls.sql`) already keys off the exact same `created_by = auth.uid()` condition to let a user add themselves as the owning member in the first place. No other insert-then-`.select()` pattern in this codebase has the same gap — every other table's rows are only ever created by someone who is *already* an org member of an *already-existing* org, so `is_org_member()` is already true at their insert time; `organizations` is the one chicken-and-egg case where the row establishes the org identity itself, before the membership relationship that would normally grant visibility exists.

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

### Phase 5 additions (`supabase/migrations/0013_phase5_rls.sql`)

| Table | Client (org member) | Super Admin |
|---|---|---|
| `off_page_opportunities`, `outreach_messages` | Full CRUD on their own org's rows — this is the client's own business-development work, same ownership model as `brand_profiles`/`content_items` (not admin-managed like `buffer_channel_links`) | SELECT only (support visibility, an opportunity-count summary — no editing control) |
| `brand_mention_searches` | SELECT/INSERT own — **no UPDATE/DELETE for anyone** (append-only, same convention as every other `*_snapshots` table) | SELECT all |

`GOOGLE_CUSTOM_SEARCH_API_KEY`/`GOOGLE_CUSTOM_SEARCH_ENGINE_ID` are app-wide, not per-org (unlike the OAuth-based Google connections) — a plain API key has no user-identity concept to scope per organization; every org's brand-mention searches go through the same key, same as `BUFFER_ACCESS_TOKEN`/`ANTHROPIC_API_KEY`.

**No bulk-send capability exists anywhere in the outreach schema or UI** — this is a security/compliance property worth calling out explicitly, not just a UX choice: `outreach_messages` are always created and sent one row, one opportunity, at a time (`draftOutreachAction`/`markOutreachSentAction` in `app/app/outreach/actions.ts` both operate on a single `opportunity_id`). There is no server action, no RLS policy, and no UI control that could send to multiple recipients in one call — the spec's §33/§36 "no mass spam, no auto forum/comment spam" rule is enforced structurally, not by a convention someone could accidentally violate later.

### Phase 6 additions (`supabase/migrations/0015_phase6_rls.sql`) — the highest-stakes RLS in this app

| Table | Client (org member) | Super Admin |
|---|---|---|
| `paid_campaigns` | Full CRUD on their own org's rows via **`paid_campaigns_update_owner`**; DELETE additionally requires `status = 'draft'` at the RLS layer (same silent-no-op pattern as Phase 2's locked `content_items` — `deleteCampaignAction` checks the returned row count) | UPDATE only, via a **separate** policy, **`paid_campaigns_update_admin`** — SELECT all |
| `paid_campaign_approvals` | INSERT own (`approved_by = auth.uid()`) + SELECT own — **no UPDATE/DELETE for anyone** (append-only, same convention as `audit_logs`/`content_versions`) | SELECT all |

**Why `paid_campaigns` has two separate UPDATE policies instead of one shared policy**: both a client and an admin can legitimately update this table, but they must never be able to write each other's fields. RLS itself doesn't restrict *which columns or values* a role writes within a row it can already reach — that's the same limitation noted for `google_connections` tokens in Phase 3. So the real enforcement that "only a client can set `status = 'approved'`" and "only an admin can set `status = 'launched_externally'`" lives in the **server actions**, not the RLS policies:
- `approveCampaignAction`/`rejectCampaignAction`/`submitForApprovalAction` (`app/app/paid-campaigns/actions.ts`) are the only code paths that write `approved`/`rejected`/`pending_approval` — no admin action ever calls them.
- `markCampaignLaunchedAction`/`updateCampaignPerformanceAction` (`app/admin/clients/[orgId]/paid-campaign-actions.ts`) validate the requested status against `ADMIN_SETTABLE_STATUSES` (`launched_externally`\|`paused`\|`completed`\|`cancelled`, `lib/constants/paid-campaigns.ts`) before writing — an admin trying to set `approved` through this action is rejected in application code, even though the RLS policy alone would technically permit the UPDATE.

**Why this isn't column-locked** (unlike `profiles.role`/`notifications.read`, which use `revoke update ... ; grant update (...)`): there is no real-money trigger anywhere in this schema — "launch" is always a manual action a human takes directly on the ad platform, recorded here only *after the fact*. A column grant would protect against a client writing `launched_externally` themselves, but that write alone can't cause any real spend (there's no code path that reacts to it by calling an ad API), so it would be security theater rather than a real boundary. The `status`-transition discipline above is the real boundary. Documented in full in the `0015_phase6_rls.sql` migration file's header comment for future maintainers, alongside the explicit callback to the same reasoning already used for `content_items.locked` in Phase 2.

`approveCampaignAction` is, deliberately, the single most locked-down action in this codebase: it requires `status = 'pending_approval'`, requires `max_spend`/`budget_period`/`start_date`/`end_date` to already be set (client-entered, never AI-set), and requires an explicit confirmation checkbox — all three checked server-side, not just enforced by the UI. No secret or API key is even reachable from this action; the entire safety property here is procedural.

### Phase 7 additions (`supabase/migrations/0017_phase7_rls.sql`) — two genuine bug fixes plus three new patterns

**Bug fix, not a feature — read this first**: `client_settings` had exactly one UPDATE policy since Phase 1 (`client_settings_admin_update`, Super-Admin-only). Every org-member-scoped write to that table — which includes Phase 2's `setControlModeAction` (the Autopilot/Approval-Required toggle) — has been silently affecting zero rows in any real deployment, the same silent-no-op class of bug documented in the Phase 2 section above, just never caught because there's been no live Supabase project to exercise it against. Fixed with a new `client_settings_owner_update` policy (`for update using (is_org_member(org_id)) with check (is_org_member(org_id))`), needed anyway to wire up this phase's Master STOP toggle. Both the admin and owner policies now coexist, same two-separate-UPDATE-policies shape already used for `paid_campaigns` in Phase 6.

**Second bug fix**: offboarding needed Super Admin write access to `content_items` (to mark not-yet-sent items `skipped`) and `google_connections` (to delete a revoked connection) — neither table had ever granted Super Admin anything beyond SELECT, because every other phase's design correctly kept these client-owned. Added `content_items_update_admin` and `google_connections_delete_admin`, both intentionally broad grants (`using (is_super_admin())`, no extra `USING` restriction) with the real restriction living in `offboardOrgAction`'s own narrowly-scoped calls (`{status:'skipped'}` only; delete only) — same allowlist-in-code pattern already established for `paid_campaigns_update_admin` in Phase 6, for the identical reason: RLS restricts which *rows* a role can reach, not which *columns or values* it writes within a row it can already reach.

| Table | Client (org member) | Super Admin | Public (`anon`) |
|---|---|---|---|
| `system_settings` | SELECT (needed so the automation guard works inside org-scoped actions) | SELECT + UPDATE | — |
| `ai_usage_events` | **No access at all** — see below | SELECT all; INSERT (for admin-triggered generation) | — |
| `conversion_links` | Full CRUD on their own org's rows | SELECT only | SELECT on `id, org_id, destination` only (column grant) |
| `conversion_events` | SELECT own; INSERT scoped to `event_type in ('lead','sale','booking')` — **no UPDATE/DELETE for anyone** (append-only) | SELECT all | INSERT scoped to `event_type = 'click' and link_id is not null` |

**`ai_usage_events` is the first append-only table in this app where the owning org gets no SELECT at all** — every other snapshot/history table (`content_versions`, `*_snapshots`, `audit_logs`) gives the org SELECT on their own rows. This one is different on purpose: `estimated_cost_usd` feeds a margin calculation that's Super-Admin-only by design (spec §30) specifically because it would reveal VMG's own cost basis and margin on that client if the client could see it. INSERT is still open to `is_org_member(org_id) or is_super_admin()`, since the actual `messages.create()` calls run under whichever session triggered them — same RLS-is-the-only-boundary model as everything else in this app.

`provider` (`0019_ai_provider_tracking.sql`, post-Phase 7, added once Kimi became a second AI option; widened by `0020_ai_provider_gemini_openai.sql` for Gemini/OpenAI) needed **no RLS change either time** — both policies above are plain row policies with no column list, so a new column (or a wider `CHECK` on an existing one) is automatically covered by whatever access the row already has. Confirmed by reading this table's policy definitions before writing each migration, not assumed.

**`conversion_links`'s anon access is a column-level GRANT restriction, not a plain row policy** — this matters and is worth being explicit about. The public `/api/track/[linkId]` redirect handler has no Supabase session at all (an anonymous website visitor), so it has to use the `anon` role to resolve a link. A plain `for select to anon using (true)` policy would not just let that one handler read one row — because the anon key is public and embeddable in any client-side code, it would let *anyone* query Supabase's REST endpoint directly and dump **every client's entire link table** in bulk, since RLS restricts which rows a query can see, not how many rows a given query is allowed to ask for. The fix is the same column-grant mechanism already proven twice in this codebase (`profiles.role`, `notifications.read`): `revoke select on conversion_links from anon; grant select (id, org_id, destination) to anon;` — `label`, `type`, `created_by`, and timestamps stay fully private from anon even though the row-level policy technically covers the whole table.

**`conversion_events`'s anon INSERT is deliberately narrow and paired with a trigger, not a subquery in the RLS check**: `conversion_events_insert_public_click` only allows `event_type = 'click' and link_id is not null` — nothing else. But that alone doesn't stop a direct API caller from pairing a spoofed `org_id` with someone else's real `link_id` in the insert payload. Rather than adding a correlated subquery to the RLS `with check` clause (correct but easy to get subtly wrong, and this codebase has no precedent for that pattern), the fix is a `before insert` trigger (`set_conversion_event_org_id()`, `security definer`, same shape as `handle_new_user`/`handle_org_activation`) that derives `org_id` from `link_id` server-side whenever a link is involved, overwriting whatever the request claimed — Postgres evaluates RLS `with check` against the row *after* `before insert` triggers run, so the org-membership check that follows (for the authenticated manual-log path) always sees the real, trigger-corrected value. A public click's `org_id` is never client-supplied at all in practice.

### Admin-only columns on `client_settings` (`0034_protect_client_settings_admin_columns.sql`, post-Phase 12)

Closes the hole the Phase 7 owner-update policy above left open: that policy is row-level, so any org member could `update` *any* column of their own org's `client_settings` row through a raw API call, including `premium_apify_enabled` (a paid add-on gate), the `manual_*` cost fields (entered on the admin Costs page), `automation_status` and `org_id`. RLS can't express a column rule, so a `BEFORE UPDATE` trigger (`protect_client_settings_admin_columns`) raises `42501` when a logged-in session that is not a Super Admin changes any of those columns. `auth.uid()` is null for the service-role client (cron, server jobs), so those are unaffected. Every client-side write in the app (Master STOP, content mode, autopilot settings, review links) touches other columns, and the only writers of the protected ones are the two admin actions (Costs page, premium toggle) — checked by reading every `client_settings` write site before shipping the trigger.

### Phase 10–12 and audit-pass tables (`0028`, `0030`, `0032`, `0035`, `0036`)

Same shape as the earlier phases: org members get access to their own org's rows (`is_org_member(org_id)`), Super Admin can read. Two are worth naming:

- **`cron_runs`** (`0035`) — Super-Admin `SELECT` only and no insert policy for any logged-in role; rows are written solely by server code holding the service-role key (the nightly Autopilot job).
- **`ai_visibility_checks`** (`0036`) — org `SELECT` and `INSERT` on their own rows, Super Admin `SELECT`; no update or delete policy (append-only history, same as the other snapshot tables).

### Verifying tenant isolation empirically

`supabase/tests/tenant_isolation_test.sql` impersonates two real clients (the `authenticated` role plus their user id) and checks that neither can read or write the other's rows in every public table with an `org_id` column, with positive controls so a broken simulation can't produce a false PASS. It also reports whether the admin-column hole is open (before `0034`) or closed (after). Nothing it does is ever committed: all of it happens in an inner block that always ends by raising an internal signal (`DC001`), which makes Postgres undo it (including the temporary switch of identity), and only the report text is kept and returned as an ordinary result table. If the test can't run at all it says `NOT RUN` in that table rather than raising an error, so it is safe to paste in the same query as the migrations — a problem in it can never roll them back. (An earlier version ended in a deliberate error whose text was the report; correct results looked like failures in the SQL Editor, and pasting it with the migrations would have rolled the migrations back, so it was changed.) It does not cover Storage bucket policies or the public (`anon`) role.

**First live run — 2026-09-22, on the production project, by the owner:** 36 tables checked, 0 cross-tenant leaks in either direction, admin-only column write `PROTECTED` (so `0034` is live), client-writable settings still work, `RESULT: PASS`. Re-run it after any change to policies or a new table with an `org_id` column.

The same SQL also runs automatically on every push (`tests/rls-isolation.test.ts`): all migrations are loaded into an in-memory Postgres with rows for two tenants in every org-scoped table, so a migration that fails to apply or opens a cross-tenant hole fails CI. That checks the migration files, **not the live project** — if the live database was ever changed by hand, only running the SQL file there can see it. The test's own detection was checked by deliberately adding a read hole and a write hole and confirming both are reported.

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
- `GOOGLE_CUSTOM_SEARCH_API_KEY`, `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` — server-only; read only inside `lib/google/custom-search.ts`. Lower sensitivity than the others (a leaked key only allows web searches billed to the project, not account access), but still never exposed to the browser.
- `MOONSHOT_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY` (post-Phase 7) — server-only; read only inside `lib/ai/providers/{kimi,gemini,openai}.ts` respectively. Each optional — only required when `AI_PROVIDER` selects that provider; the app runs fine without any of them (default provider is Anthropic). Same sensitivity class as `ANTHROPIC_API_KEY`. `GEMINI_API_KEY` is a distinct credential from `GOOGLE_CLIENT_ID`/`GOOGLE_CUSTOM_SEARCH_API_KEY` above — a different Google API (Generative Language, not OAuth or Custom Search), issued from a different console page, not interchangeable.
- `TOKEN_ENCRYPTION_KEY` (optional, recommended) — server-side only; read only inside `lib/security/secret-box.ts`. Encrypts third-party tokens at rest (AES-256-GCM, authenticated, a fresh random IV per value; stored as `enc:v1:` + base64). **Backward compatible on purpose:** with no key set values are stored as before, and a stored value without the `enc:v1:` prefix is legacy plain text and is read as-is, so switching it on never breaks a working connection. Only *newly written* tokens are encrypted (a fresh connect, or a Google access-token refresh); reconnecting re-saves an old one encrypted. **Never change or lose the key** — a value encrypted with one key can't be read with another, and every affected client would have to reconnect. A token that can't be decrypted reads as "not connected" (the client is asked to reconnect) rather than crashing a page; offboarding counts it under `googleRevokeFailures` because it could not be revoked at Google.

## What's still not covered

- Rate limiting, login-history UI, suspicious-activity alerts (spec §26) — infra-level concerns better handled by Supabase's own auth rate limits initially; a dedicated implementation is a later-phase item.
- Real KYC/Aadhaar verification — documents are stored and reviewed by a human, not verified against a government API.
- AI caption generation has a monthly per-org safety cap (Phase 2, `MONTHLY_AI_GENERATION_SAFETY_CAP`, which the AI Assistant's `regenerate_content` tool also respects as of Phase 7); AI report-narrative generation (Phase 3), publish-dispatch (Phase 4), off-page assessment/outreach drafting (Phase 5), campaign-brief drafting (Phase 6), and the assistant's own conversation turns (Phase 7, capped only by round-trips per message, not a monthly ceiling) do **not** have a monthly cap yet — worth adding before real client traffic, same reasoning as spec §30/§36. Phase 7's `ai_usage_events` table (see above) at least makes the real cost of not having one visible for the first time.
- The "client approves, admin launches" boundary on `paid_campaigns.status` (Phase 6) is enforced in the server actions, not at the RLS layer — see the Phase 6 RLS section above for the full reasoning on why a column-lock isn't a better fit here. Worth a defense-in-depth RLS `CHECK`/trigger constraining which role can write which status values if this table's write surface ever grows past the two current action files.
- Google OAuth tokens and clients' Apify tokens are ordinary columns in Postgres, protected by RLS, the column-discipline above and Supabase's encryption at rest. As of the September 2026 audit pass they can also be encrypted at the application layer with `TOKEN_ENCRYPTION_KEY` (see Secrets above) — but only once that key is set, and only for tokens written afterwards; anything saved earlier stays readable text until the client reconnects. That is a deliberate trade for not breaking live connections. A dedicated secrets layer (`pgsodium`/Vault) would also keep the key out of the app's own environment; revisit if handling higher-sensitivity scopes later.
- No rate limit or ownership check on `checkPublishStatusAction`/`dispatchToPublisher` beyond normal org-membership — a client could in principle re-check status repeatedly; low real-world risk (Buffer/YouTube's own APIs would rate-limit first) but worth a look before high-volume use.
- `addOpportunityAction`/`checkBacklinkAction` fetch arbitrary client-submitted URLs server-side (SSRF-shaped surface, same as Phase 3's SEO audit and link health check) — mitigated by the existing `fetchWithTimeout` abort-after-8s pattern, but there's no allowlist/denylist against internal-network addresses (e.g. `169.254.169.254`, `localhost`). Low risk in a Vercel-style serverless deployment (no internal network to reach) but worth hardening before self-hosting on a VM with internal services.
- (Phase 7) `lib/buffer/client.ts`/`lib/youtube/client.ts` don't distinguish an HTTP 429 (rate limit) from any other error, so the Connection Health Center's "Rate Limited" state is never produced — see `ARCHITECTURE.md`'s Connection Health Center section. Same reasoning as the `api_health_events` deferral: low value without a cron/polling platform to check it proactively, and that's still gated on the open hosting decision (spec §37.3).
- (Phase 7) `offboardOrgAction` continues past an individual Google token-revoke failure (counts it in the audit log's `googleRevokeFailures` rather than aborting) so one already-invalid token can't block the rest of offboarding — the connection row is deleted from Digital Command either way, since a failed *revoke* doesn't mean the row should stay. Worth surfacing that count in the admin UI (currently audit-log-only) if failures turn out to be common in practice.
- (Phase 7) The Cost Dashboard's USD→INR conversion (`lib/constants/currency.ts`) is a fixed constant, not a live exchange rate — approximate by design (see `PROJECT_PLAN.md`), same discipline as the Haiku pricing constants, but worth swapping for a fetched rate if margin precision ever matters at the accounting level.
