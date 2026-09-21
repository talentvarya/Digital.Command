-- Digital Command — AI answer checks (does an AI engine name this business?)
-- Run after 0035_cron_runs.sql.
--
-- One row per (query, engine) per run, so mention-rate trends are a plain
-- query. Engine is 'google_ai_mode' for now — the only AI add-on of Apify's
-- Google Search scraper whose output shape is documented with a real example
-- (see lib/apify/ai-visibility.ts). raw keeps the engine's payload exactly as
-- returned: it is the evidence needed to verify and later add the engines
-- whose output format isn't documented (ChatGPT, Perplexity, Gemini...).
create table public.ai_visibility_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  query text not null,
  engine text not null default 'google_ai_mode',
  answered boolean not null,
  brand_mentioned boolean not null default false,
  brand_cited boolean not null default false,
  competitors_mentioned text[] not null default '{}',
  excerpt text,
  sources jsonb not null default '[]'::jsonb,
  raw jsonb,
  run_at timestamptz not null default now(),
  triggered_by uuid references public.profiles (id)
);

create index ai_visibility_checks_org_id_idx on public.ai_visibility_checks (org_id, run_at desc);

alter table public.ai_visibility_checks enable row level security;

create policy ai_visibility_checks_select on public.ai_visibility_checks
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy ai_visibility_checks_insert on public.ai_visibility_checks
  for insert with check (public.is_org_member(org_id));
