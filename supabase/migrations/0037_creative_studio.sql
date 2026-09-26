-- Digital Command — Creative Studio usage log
-- Run after 0036_ai_visibility_checks.sql. Safe to run more than once.
--
-- One row per post graphic made. The AI photo rows are what keep the shared FREE
-- image allowance from being used up by one client: the server counts today's
-- 'ai_photo' rows per business and across the platform before making another.
-- Clients can read their own rows but there is deliberately NO insert policy for
-- any logged-in role — only server code with the service-role key writes here,
-- so nobody can fake usage to block other clients' AI photos.
create table if not exists public.creative_generations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  content_item_id uuid references public.content_items (id) on delete set null,
  kind text not null check (kind in ('template', 'ai_photo')),
  provider text not null,
  style text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists creative_generations_org_day_idx on public.creative_generations (org_id, created_at desc);
create index if not exists creative_generations_kind_day_idx on public.creative_generations (kind, created_at desc);

alter table public.creative_generations enable row level security;

drop policy if exists creative_generations_select on public.creative_generations;
create policy creative_generations_select on public.creative_generations
  for select using (public.is_org_member(org_id) or public.is_super_admin());
