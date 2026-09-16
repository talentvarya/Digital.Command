-- Digital Command — Phase 8 Row Level Security
-- Run after 0022_phase8_reputation_schema.sql.

alter table public.review_requests enable row level security;

create policy review_requests_select on public.review_requests
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy review_requests_insert on public.review_requests
  for insert with check (public.is_org_member(org_id));

alter table public.reviews enable row level security;

create policy reviews_select on public.reviews
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy reviews_insert on public.reviews
  for insert with check (public.is_org_member(org_id));
create policy reviews_update on public.reviews
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy reviews_delete on public.reviews
  for delete using (public.is_org_member(org_id));
