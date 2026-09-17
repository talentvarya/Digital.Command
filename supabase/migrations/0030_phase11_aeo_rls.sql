-- Digital Command — Phase 11 Row Level Security
-- Run after 0029_phase11_aeo_schema.sql.

alter table public.aeo_audits enable row level security;

create policy aeo_audits_select on public.aeo_audits
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy aeo_audits_insert on public.aeo_audits
  for insert with check (public.is_org_member(org_id));
create policy aeo_audits_update on public.aeo_audits
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
