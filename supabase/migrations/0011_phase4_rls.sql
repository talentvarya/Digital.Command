-- Digital Command — Phase 4 Row Level Security
-- Run after 0010_phase4_schema.sql.

-- ============================================================================
-- buffer_channel_links — admin-managed (see spec note in 0010). Client gets
-- read-only visibility of their own org's rows; only Super Admin can write.
-- ============================================================================
alter table public.buffer_channel_links enable row level security;

create policy buffer_channel_links_select on public.buffer_channel_links
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy buffer_channel_links_admin_write on public.buffer_channel_links
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- content_items' new columns (buffer_post_id, youtube_video_id, publish_status,
-- publish_error) ride the table's existing policies from 0006_phase2_rls.sql —
-- no new policy needed, same rows, same is_org_member(org_id) owner.
