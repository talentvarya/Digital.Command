-- Digital Command — Phase 2 storage buckets + policies
-- Run after 0006_phase2_rls.sql.
-- Path convention (same as Phase 1): {org_id}/{uuid}-{original filename}

insert into storage.buckets (id, name, public)
values
  ('brand-assets', 'brand-assets', false),
  ('content-media', 'content-media', false)
on conflict (id) do nothing;

create policy brand_assets_select on storage.objects
  for select using (
    bucket_id = 'brand-assets'
    and (public.is_super_admin() or public.is_org_member(((storage.foldername(name))[1])::uuid))
  );

create policy brand_assets_insert on storage.objects
  for insert with check (
    bucket_id = 'brand-assets'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy brand_assets_delete on storage.objects
  for delete using (
    bucket_id = 'brand-assets'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy content_media_bucket_select on storage.objects
  for select using (
    bucket_id = 'content-media'
    and (public.is_super_admin() or public.is_org_member(((storage.foldername(name))[1])::uuid))
  );

create policy content_media_bucket_insert on storage.objects
  for insert with check (
    bucket_id = 'content-media'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy content_media_bucket_delete on storage.objects
  for delete using (
    bucket_id = 'content-media'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
