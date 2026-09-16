-- Digital Command — Phase 9 Row Level Security
-- Run after 0024_phase9_roadmap_leads_schema.sql.

alter table public.roadmap_leads enable row level security;

create policy roadmap_leads_select_admin on public.roadmap_leads
  for select using (public.is_super_admin());
create policy roadmap_leads_update_admin on public.roadmap_leads
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- Deliberately NO insert policy for anon or authenticated roles. The public
-- roadmap form's Server Action writes through the service-role client
-- (createServiceClient(), which bypasses RLS entirely), so no client-side
-- Supabase call — from this app or any other origin — could ever read or
-- write this table even if it tried. Stricter than granting anon a narrow
-- INSERT policy (the pattern used for conversion_events' public click
-- route), and appropriate here since this write happens inside a trusted
-- Server Action rather than a bare public GET redirect.
