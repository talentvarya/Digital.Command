-- Digital Command — Phase 3 schema: SEO audits, Google connections, Reports
-- Run after 0007_phase2_storage.sql.

-- ============================================================================
-- google_connections — OAuth tokens for Search Console / Analytics (spec §9.1)
-- Tokens are read/refreshed exclusively by server-side code; every UI query
-- against this table must select only safe columns (see SECURITY_AND_RLS.md).
-- ============================================================================
create table public.google_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  service text not null check (service in ('search_console', 'analytics')),
  external_property text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text not null default 'not_added'
    check (status in ('connected', 'not_added', 'reconnect_required', 'error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, service)
);

-- ============================================================================
-- seo_audits — technical SEO crawl results (spec §9.1)
-- ============================================================================
create table public.seo_audits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  score int not null check (score between 0 and 100),
  issues jsonb not null default '[]'::jsonb,
  crawled_at timestamptz not null default now(),
  triggered_by uuid references public.profiles (id)
);

create index seo_audits_org_id_idx on public.seo_audits (org_id, crawled_at desc);

-- ============================================================================
-- search_console_snapshots — also the keyword-tracking data source (top_queries)
-- ============================================================================
create table public.search_console_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  synced_at timestamptz not null default now(),
  site_url text not null,
  date_range_start date not null,
  date_range_end date not null,
  total_clicks int not null default 0,
  total_impressions int not null default 0,
  avg_ctr numeric(6, 4) not null default 0,
  avg_position numeric(6, 2) not null default 0,
  top_queries jsonb not null default '[]'::jsonb,
  top_pages jsonb not null default '[]'::jsonb
);

create index search_console_snapshots_org_id_idx on public.search_console_snapshots (org_id, synced_at desc);

-- ============================================================================
-- analytics_snapshots
-- ============================================================================
create table public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  synced_at timestamptz not null default now(),
  property_id text not null,
  date_range_start date not null,
  date_range_end date not null,
  sessions int not null default 0,
  users int not null default 0,
  conversions int not null default 0,
  top_pages jsonb not null default '[]'::jsonb
);

create index analytics_snapshots_org_id_idx on public.analytics_snapshots (org_id, synced_at desc);

-- ============================================================================
-- reports — spec §21 (Work Completed / Next Plan, generated on demand)
-- ============================================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles (id),
  metrics_snapshot jsonb not null default '{}'::jsonb,
  summary_text text,
  next_plan_text text
);

create index reports_org_id_idx on public.reports (org_id, generated_at desc);
