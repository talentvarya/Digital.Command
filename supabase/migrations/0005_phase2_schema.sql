-- Digital Command — Phase 2 schema: Brand Brain, Links, 7-Day Planner, Notifications
-- Run after 0004_seed.sql.

-- ============================================================================
-- brand_profiles — one row per org (spec §18)
-- ============================================================================
create table public.brand_profiles (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  logo_path text,
  colors jsonb not null default '[]'::jsonb,
  fonts jsonb not null default '[]'::jsonb,
  business_description text,
  products_services text,
  target_audience text,
  locations text,
  phone text,
  whatsapp text,
  offers text,
  cta_style text,
  preferred_tone text,
  words_to_avoid jsonb not null default '[]'::jsonb,
  image_style text,
  video_style text,
  competitors jsonb not null default '[]'::jsonb,
  reference_content text,
  approved_examples text,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- org_links — manual URL registry (spec §12). OAuth "Connect Account" for
-- FB/IG/YouTube/GBP is Phase 4 (needs Buffer/Graph API credentials); this
-- table covers the URL-storage + health-check half that works today.
-- ============================================================================
create table public.org_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  link_type text not null check (link_type in (
    'website', 'blog', 'google_business_profile', 'facebook', 'instagram',
    'youtube', 'x', 'pinterest', 'other'
  )),
  url text not null,
  label text,
  status text not null default 'not_added'
    check (status in ('connected', 'not_added', 'reconnect_required', 'error')),
  last_checked_at timestamptz,
  last_check_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index org_links_org_id_idx on public.org_links (org_id);

-- ============================================================================
-- content_items / content_media / content_versions — 7-Day Planner (spec §11)
-- ============================================================================
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram', 'youtube')),
  scheduled_date date not null,
  scheduled_time time,
  caption text,
  hashtags text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'waiting_approval', 'approved', 'scheduled', 'published', 'rejected', 'skipped')),
  source text not null
    check (source in ('ai_generated', 'client_uploaded', 'admin_created', 'gpt_assistant_generated')),
  control_mode text not null check (control_mode in ('autopilot', 'approval_required')),
  locked boolean not null default false,
  rejection_count int not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_items_org_id_idx on public.content_items (org_id);
create index content_items_org_date_idx on public.content_items (org_id, scheduled_date);

create table public.content_media (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index content_media_content_item_id_idx on public.content_media (content_item_id);

-- Append-only history of AI generations/edits — feeds the "3 rejections then
-- ask for a client suggestion" revision flow (spec §10).
create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  version_number int not null,
  caption text,
  hashtags text[] not null default '{}',
  generated_by text not null check (generated_by in ('ai', 'client_suggestion', 'client_edit', 'admin')),
  client_suggestion_text text,
  created_at timestamptz not null default now()
);

create index content_versions_content_item_id_idx on public.content_versions (content_item_id);

-- ============================================================================
-- notifications — in-app only for now (email receipts still deferred)
-- ============================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id),
  type text not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_org_id_idx on public.notifications (org_id);
create index notifications_user_id_idx on public.notifications (user_id);

-- ============================================================================
-- client_settings — add content control mode (spec §10)
-- ============================================================================
alter table public.client_settings
  add column content_control_mode text not null default 'approval_required'
    check (content_control_mode in ('autopilot', 'approval_required')),
  add column approval_then_autopilot boolean not null default false,
  add column autopilot_since date;
