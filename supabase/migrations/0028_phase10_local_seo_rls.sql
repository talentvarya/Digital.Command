-- Digital Command — Phase 10 Row Level Security
-- Run after 0027_phase10_local_seo_schema.sql.

alter table public.local_seo_profiles enable row level security;

create policy local_seo_profiles_select on public.local_seo_profiles
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy local_seo_profiles_insert on public.local_seo_profiles
  for insert with check (public.is_org_member(org_id));
create policy local_seo_profiles_update on public.local_seo_profiles
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

alter table public.local_seo_posts enable row level security;

create policy local_seo_posts_select on public.local_seo_posts
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy local_seo_posts_insert on public.local_seo_posts
  for insert with check (public.is_org_member(org_id));
create policy local_seo_posts_update on public.local_seo_posts
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
