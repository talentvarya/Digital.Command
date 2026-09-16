-- Digital Command — Phase 9 schema: Public Roadmap Lead Magnet
-- Run after 0023_phase8_reputation_rls.sql.
--
-- A free, public, unauthenticated tool on the marketing homepage: a visitor
-- fills in their business details, gets an AI-generated growth roadmap
-- immediately, and their answers are saved here as a sales lead for VMG's
-- own Super Admin to follow up on. This table has nothing to do with any
-- client org — it's VMG's own top-of-funnel CRM, not a Digital Command
-- product feature a client ever sees.
--
-- Writes go through the service-role client from a Server Action (see
-- app/roadmap/actions.ts), never through the anon/cookie client — see
-- 0025's RLS file for why there's deliberately no anon insert policy here.
create table public.roadmap_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  contact_phone text not null,
  contact_email text,
  industry text,
  city text,
  current_website text,
  current_social text,
  current_reviews text,
  current_marketing text,
  primary_goal text,
  timeline text,
  budget_range text,
  target_audience text,
  competitors text,
  brand_tone text,
  products_offers text,
  roadmap_current_state text[] not null default '{}',
  roadmap_phases jsonb not null default '[]'::jsonb,
  roadmap_vision text,
  roadmap_urgency_line text,
  estimated_ai_cost_usd numeric(12, 6) not null default 0,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'not_interested')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index roadmap_leads_created_at_idx on public.roadmap_leads (created_at desc);
create index roadmap_leads_status_idx on public.roadmap_leads (status);
