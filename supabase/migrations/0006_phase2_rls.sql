-- Digital Command — Phase 2 Row Level Security
-- Run after 0005_phase2_schema.sql. Reuses is_super_admin()/is_org_member()
-- from 0002_rls.sql.

-- ============================================================================
-- brand_profiles — the client's own creative asset, full CRUD for the owning
-- org, read-only for Super Admin (support visibility, not editing control).
-- ============================================================================
alter table public.brand_profiles enable row level security;

create policy brand_profiles_select on public.brand_profiles
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy brand_profiles_insert on public.brand_profiles
  for insert with check (public.is_org_member(org_id));
create policy brand_profiles_update on public.brand_profiles
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- ============================================================================
-- org_links
-- ============================================================================
alter table public.org_links enable row level security;

create policy org_links_select on public.org_links
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy org_links_insert on public.org_links
  for insert with check (public.is_org_member(org_id));
create policy org_links_update on public.org_links
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy org_links_delete on public.org_links
  for delete using (public.is_org_member(org_id));

-- ============================================================================
-- content_items — locked items can't be deleted by the client (must unlock
-- first); Super Admin gets read-only support visibility, no write access —
-- approval is the client's call per spec, not admin's.
-- ============================================================================
alter table public.content_items enable row level security;

create policy content_items_select on public.content_items
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy content_items_insert on public.content_items
  for insert with check (public.is_org_member(org_id));
create policy content_items_update on public.content_items
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy content_items_delete on public.content_items
  for delete using (public.is_org_member(org_id) and locked = false);

-- ============================================================================
-- content_media
-- ============================================================================
alter table public.content_media enable row level security;

create policy content_media_select on public.content_media
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy content_media_insert on public.content_media
  for insert with check (public.is_org_member(org_id));
create policy content_media_delete on public.content_media
  for delete using (public.is_org_member(org_id));

-- ============================================================================
-- content_versions — append-only, no update/delete policy for anyone
-- ============================================================================
alter table public.content_versions enable row level security;

create policy content_versions_select on public.content_versions
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy content_versions_insert on public.content_versions
  for insert with check (public.is_org_member(org_id));

-- ============================================================================
-- notifications — insertable by the org itself (planner actions) or Super
-- Admin (e.g. activation notices); only the `read` column is client-editable.
-- ============================================================================
alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy notifications_insert on public.notifications
  for insert with check (public.is_org_member(org_id) or public.is_super_admin());
create policy notifications_update on public.notifications
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;
