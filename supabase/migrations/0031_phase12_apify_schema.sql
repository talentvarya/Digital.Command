-- Digital Command — Phase 12 schema: Competitor Search (Apify), premium add-on
-- Run after 0030_phase11_aeo_rls.sql.
--
-- Real Google SERP/competitor data needs a paid third-party scraping vendor
-- (Apify) — same "new paid vendor relationship" line already declined twice
-- for competitor tracking (Phase 3) and backlink-index data (Phase 5) absent
-- explicit sign-off. Here the owner explicitly asked for it, with two
-- conditions that shape the schema: (1) each client brings their own Apify
-- account/API token — usage is billed to the client's own Apify account, not
-- VMG's, so there's no shared-cost problem to solve; (2) it's a premium
-- add-on a Super Admin must switch on per client before that client can even
-- see the module — mirrors Master STOP's existing boolean-flag-on-
-- client_settings pattern, not a new plan-tier system nobody asked for.

-- ============================================================================
-- client_settings — the premium gate. Off by default; only a Super Admin can
-- flip it (see setPremiumApifyAction, admin-only like setSandboxAction).
-- ============================================================================
alter table public.client_settings
  add column if not exists premium_apify_enabled boolean not null default false;

-- ============================================================================
-- apify_connections — one row per org. The client's own Apify API token,
-- entered by the client (like a Google review link, not an OAuth flow —
-- Apify has no per-client OAuth). Same discipline as google_connections:
-- the token column must never be selected into a client-facing query result
-- (see ApifyConnectionPublic in types/database.ts) — only server code that's
-- about to call Apify's API reads it.
-- ============================================================================
create table public.apify_connections (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  api_token text,
  status text not null default 'not_added' check (status in ('connected', 'not_added', 'error')),
  connected_at timestamptz,
  last_used_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- apify_search_snapshots — one row per competitor-search run. own_domain is
-- read from the client's own website link (org_links) at run time so
-- position tracking stays accurate if that link changes later.
-- ============================================================================
create table public.apify_search_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  query text not null,
  country_code text,
  own_domain text,
  own_domain_position int,
  top_results jsonb not null default '[]'::jsonb,
  run_at timestamptz not null default now(),
  triggered_by uuid references public.profiles (id)
);

create index apify_search_snapshots_org_id_idx on public.apify_search_snapshots (org_id, run_at desc);
