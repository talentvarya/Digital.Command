-- Digital Command — Phase 7 Row Level Security
-- Run after 0016_phase7_schema.sql.

-- ----------------------------------------------------------------------------
-- Bug fix: client_settings had no owner-update policy at all — only
-- client_settings_admin_update (0002_rls.sql) existed, so Phase 2's
-- setControlModeAction has been silently updating zero rows for every real
-- client since it was written (a client-session .update() call under RLS
-- with no matching policy just affects nothing, no error). Master STOP needs
-- exactly this same owner-write access, so fixing it here rather than
-- treating it as a separate item. Two separate UPDATE policies, same
-- precedent as paid_campaigns in Phase 6 — the admin policy stays for
-- support/override use.
-- ----------------------------------------------------------------------------
create policy client_settings_owner_update on public.client_settings
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- ----------------------------------------------------------------------------
-- Offboarding needs two narrow admin write paths that didn't exist before —
-- content_items and google_connections were both fully org-member-only for
-- writes (client owns their own content/connections; that's correct for
-- every other phase). The real restriction on what an admin can actually do
-- with these grants lives in offboardOrgAction's own narrowly-scoped calls
-- ({status:'skipped'} only; delete only), not in the policy itself — same
-- allowlist-in-code pattern already used for paid_campaigns_update_admin in
-- Phase 6, for the same reason (RLS restricts which rows, not which columns
-- or values within a row).
-- ----------------------------------------------------------------------------
create policy content_items_update_admin on public.content_items
  for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy google_connections_delete_admin on public.google_connections
  for delete using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- system_settings — every signed-in user's session needs to read
-- emergency_freeze (the automation guard runs inside org-member-scoped
-- actions), but only Super Admin can ever flip it.
-- ----------------------------------------------------------------------------
alter table public.system_settings enable row level security;

create policy system_settings_select on public.system_settings
  for select to authenticated using (true);
create policy system_settings_admin_update on public.system_settings
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- ai_usage_events — append-only. Deliberately the first such table where the
-- owning org does NOT get SELECT: estimated_cost_usd feeds a margin
-- calculation that's Super-Admin-only by design (§30) precisely because it
-- would reveal VMG's own cost basis on that client if exposed to them.
-- INSERT stays open to the org member whose own session triggered the
-- underlying AI call (or Super Admin, for any admin-triggered generation).
-- ----------------------------------------------------------------------------
alter table public.ai_usage_events enable row level security;

create policy ai_usage_events_select_admin on public.ai_usage_events
  for select using (public.is_super_admin());
create policy ai_usage_events_insert on public.ai_usage_events
  for insert with check (public.is_org_member(org_id) or public.is_super_admin());

-- ----------------------------------------------------------------------------
-- conversion_links — client-owned (like brand_profiles/content_items), full
-- CRUD for the org, read-only for Super Admin. PLUS a narrow anon grant so
-- the public /api/track/[linkId] redirect (hit by anonymous site visitors,
-- no Supabase session at all) can resolve a link. This is a column-level
-- GRANT restriction, not just a row policy — a plain `for select to anon
-- using (true)` would let anyone query Supabase's REST endpoint directly
-- (the anon key is public/embeddable) and dump every client's link labels
-- and destinations in bulk, since RLS restricts which rows are visible, not
-- how many a given query asks for. Same column-grant mechanism already used
-- for profiles.role and notifications.read.
-- ----------------------------------------------------------------------------
alter table public.conversion_links enable row level security;

create policy conversion_links_select on public.conversion_links
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy conversion_links_insert on public.conversion_links
  for insert with check (public.is_org_member(org_id));
create policy conversion_links_update on public.conversion_links
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy conversion_links_delete on public.conversion_links
  for delete using (public.is_org_member(org_id));

create policy conversion_links_public_select on public.conversion_links
  for select to anon using (true);
revoke select on public.conversion_links from anon;
grant select (id, org_id, destination) on public.conversion_links to anon;

-- ----------------------------------------------------------------------------
-- conversion_events — append-only. Two non-overlapping INSERT policies: the
-- org member logs their own lead/sale/booking; anyone (anon) can log a
-- click, since that's the whole point of the public tracking redirect —
-- org_id spoofing is prevented at the trigger layer (0016), not here.
-- ----------------------------------------------------------------------------
alter table public.conversion_events enable row level security;

create policy conversion_events_select on public.conversion_events
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy conversion_events_insert_owner on public.conversion_events
  for insert with check (public.is_org_member(org_id) and event_type in ('lead', 'sale', 'booking'));
create policy conversion_events_insert_public_click on public.conversion_events
  for insert to anon with check (event_type = 'click' and link_id is not null);
