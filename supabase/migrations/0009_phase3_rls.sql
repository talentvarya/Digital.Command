-- Digital Command — Phase 3 Row Level Security
-- Run after 0008_phase3_schema.sql.

alter table public.google_connections enable row level security;

create policy google_connections_select on public.google_connections
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy google_connections_insert on public.google_connections
  for insert with check (public.is_org_member(org_id));
create policy google_connections_update on public.google_connections
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy google_connections_delete on public.google_connections
  for delete using (public.is_org_member(org_id));

alter table public.seo_audits enable row level security;

create policy seo_audits_select on public.seo_audits
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy seo_audits_insert on public.seo_audits
  for insert with check (public.is_org_member(org_id));

alter table public.search_console_snapshots enable row level security;

create policy search_console_snapshots_select on public.search_console_snapshots
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy search_console_snapshots_insert on public.search_console_snapshots
  for insert with check (public.is_org_member(org_id));

alter table public.analytics_snapshots enable row level security;

create policy analytics_snapshots_select on public.analytics_snapshots
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy analytics_snapshots_insert on public.analytics_snapshots
  for insert with check (public.is_org_member(org_id));

alter table public.reports enable row level security;

create policy reports_select on public.reports
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy reports_insert on public.reports
  for insert with check (public.is_org_member(org_id));
