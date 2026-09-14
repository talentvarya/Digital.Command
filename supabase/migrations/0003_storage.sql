-- Digital Command — Storage buckets + policies
-- Run after 0002_rls.sql.
-- Upload path convention for both buckets: {org_id}/{uuid}-{original filename}

insert into storage.buckets (id, name, public)
values
  ('verification-documents', 'verification-documents', false),
  ('payment-screenshots', 'payment-screenshots', false)
on conflict (id) do nothing;

create policy verification_documents_select on storage.objects
  for select using (
    bucket_id = 'verification-documents'
    and (
      public.is_super_admin()
      or public.is_org_member(((storage.foldername(name))[1])::uuid)
    )
  );

create policy verification_documents_insert on storage.objects
  for insert with check (
    bucket_id = 'verification-documents'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy payment_screenshots_select on storage.objects
  for select using (
    bucket_id = 'payment-screenshots'
    and (
      public.is_super_admin()
      or public.is_org_member(((storage.foldername(name))[1])::uuid)
    )
  );

create policy payment_screenshots_insert on storage.objects
  for insert with check (
    bucket_id = 'payment-screenshots'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
