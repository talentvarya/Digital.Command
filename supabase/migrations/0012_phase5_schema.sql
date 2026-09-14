-- Digital Command — Phase 5 schema: Off-page opportunities, outreach, brand mentions
-- Run after 0011_phase4_rls.sql.

-- ============================================================================
-- off_page_opportunities — spec §9.2. A candidate URL the client/admin found
-- (guest post, broken-link target, unlinked mention, etc.) — not an
-- automated web-wide discovery engine (that needs a backlink index, an
-- explicitly deferred paid-vendor decision — see API_INTEGRATIONS.md).
-- ============================================================================
create table public.off_page_opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  opportunity_type text not null default 'other'
    check (opportunity_type in ('guest_contribution', 'broken_link', 'unlinked_mention', 'other')),
  status text not null default 'new'
    check (status in ('new', 'assessed', 'contacted', 'awaiting_response', 'link_acquired', 'declined', 'lost')),
  relevance_score int check (relevance_score between 0 and 100),
  quality_notes text,
  spam_risk text check (spam_risk in ('low', 'medium', 'high')),
  contact_email text,
  contact_name text,
  link_verified boolean not null default false,
  link_last_checked_at timestamptz,
  link_first_confirmed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index off_page_opportunities_org_id_idx on public.off_page_opportunities (org_id);

-- ============================================================================
-- outreach_messages — one-at-a-time, human-reviewed drafts (spec §9.2
-- "Personalized outreach" / "Controlled follow-up"). Sending is manual by
-- design — no bulk-send capability exists anywhere in this schema, which is
-- what keeps this structurally compliant with spec §33/§36's "no mass spam"
-- rule rather than relying on a policy nobody enforces.
-- ============================================================================
create table public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.off_page_opportunities (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  subject text,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at timestamptz,
  follow_up_due_at date,
  generated_by text not null default 'ai' check (generated_by in ('ai', 'admin', 'client')),
  created_at timestamptz not null default now()
);

create index outreach_messages_opportunity_id_idx on public.outreach_messages (opportunity_id);

-- ============================================================================
-- brand_mention_searches — append-only snapshot of a Google Custom Search
-- query for the client's brand name (spec §9.2 "Unlinked brand mentions").
-- ============================================================================
create table public.brand_mention_searches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  query text not null,
  searched_at timestamptz not null default now(),
  results jsonb not null default '[]'::jsonb
);

create index brand_mention_searches_org_id_idx on public.brand_mention_searches (org_id, searched_at desc);
