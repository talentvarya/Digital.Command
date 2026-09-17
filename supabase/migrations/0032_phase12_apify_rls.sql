-- Digital Command — Phase 12 Row Level Security
-- Run after 0031_phase12_apify_schema.sql.

alter table public.apify_connections enable row level security;

create policy apify_connections_select on public.apify_connections
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy apify_connections_insert on public.apify_connections
  for insert with check (public.is_org_member(org_id));
create policy apify_connections_update on public.apify_connections
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

alter table public.apify_search_snapshots enable row level security;

create policy apify_search_snapshots_select on public.apify_search_snapshots
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy apify_search_snapshots_insert on public.apify_search_snapshots
  for insert with check (public.is_org_member(org_id));
