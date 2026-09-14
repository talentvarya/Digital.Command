-- Digital Command — Phase 4 schema: Buffer channel links + publish tracking
-- Run after 0009_phase3_rls.sql.

-- ============================================================================
-- buffer_channel_links — admin-managed mapping from an org+platform to one of
-- VMG's own Buffer channels (see ARCHITECTURE.md: Buffer's current API only
-- supports a personal key tied to one Buffer account, not per-client OAuth,
-- so this is intentionally admin-owned rather than client-owned like
-- org_links/google_connections).
-- ============================================================================
create table public.buffer_channel_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram')),
  buffer_channel_id text not null,
  buffer_channel_name text,
  linked_by uuid references public.profiles (id),
  linked_at timestamptz not null default now(),
  unique (org_id, platform)
);

create index buffer_channel_links_org_id_idx on public.buffer_channel_links (org_id);

-- ============================================================================
-- content_items — publish tracking (spec §11 status now reaches 'published'
-- for real once Buffer/YouTube confirm)
-- ============================================================================
alter table public.content_items
  add column buffer_post_id text,
  add column youtube_video_id text,
  add column publish_status text not null default 'not_sent'
    check (publish_status in ('not_sent', 'sent', 'error')),
  add column publish_error text;

-- ============================================================================
-- google_connections — add youtube as a third service alongside search_console
-- and analytics (client-managed OAuth, unlike buffer_channel_links above)
-- ============================================================================
alter table public.google_connections drop constraint google_connections_service_check;
alter table public.google_connections
  add constraint google_connections_service_check
  check (service in ('search_console', 'analytics', 'youtube'));
