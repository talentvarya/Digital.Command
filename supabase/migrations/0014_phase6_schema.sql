-- Digital Command — Phase 6 schema: Paid campaign preparation + manual approval
-- Run after 0013_phase5_rls.sql.
--
-- Deliberate safety boundary (spec §14/§36, master prompt rule #6): this
-- schema is the full "prepare + approve + audit" system of record. Nothing
-- here ever calls a live ad-platform API or triggers spend — "launch" is a
-- manual handoff recorded after the fact by an admin who did it directly in
-- Google Ads/Meta's own dashboard. See ARCHITECTURE.md.

create table public.paid_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  platform text not null check (platform in ('google_ads', 'meta_facebook', 'meta_instagram', 'youtube_ads', 'other')),
  name text not null,
  objective text,
  audience_description text,
  keywords jsonb not null default '[]'::jsonb,
  creative_brief text,
  suggested_budget numeric(12, 2),
  suggested_budget_notes text,
  max_spend numeric(12, 2),
  budget_period text check (budget_period in ('daily', 'total_campaign')),
  start_date date,
  end_date date,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'launched_externally', 'paused', 'completed', 'cancelled')),
  external_campaign_id text,
  external_platform_status text,
  spend_to_date numeric(12, 2),
  clicks int,
  conversions int,
  performance_updated_at timestamptz,
  performance_updated_by uuid references public.profiles (id),
  launched_by uuid references public.profiles (id),
  launched_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index paid_campaigns_org_id_idx on public.paid_campaigns (org_id);

-- Append-only — one row per approval/rejection decision, not per campaign, so
-- re-approving an edited campaign never overwrites proof of what an earlier
-- approval actually covered. approval_version is spec §14's explicit field.
create table public.paid_campaign_approvals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.paid_campaigns (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  approval_version int not null,
  max_spend numeric(12, 2),
  budget_period text,
  start_date date,
  end_date date,
  approved_by uuid references public.profiles (id),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index paid_campaign_approvals_campaign_id_idx on public.paid_campaign_approvals (campaign_id);
