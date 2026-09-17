-- Digital Command — Phase 11 schema: AI Search Visibility (AEO)
-- Run after 0028_phase10_local_seo_rls.sql.
--
-- "AEO" (Answer Engine Optimization) here means: is this business's own
-- website structured so an AI answer engine (ChatGPT/Gemini/Perplexity, when
-- a user asks it something like "best chocolate shop in Pune") has clear,
-- extractable facts to work with — FAQ content, structured data, plain NAP
-- text, review signals. This app does not and cannot query live AI engines
-- to check real-world visibility (no such API exists, and simulating one
-- would risk implying a guarantee this codebase's own AI-generation
-- discipline explicitly forbids — see ARCHITECTURE.md). What's genuinely
-- buildable today, same as the Phase 3 SEO audit: a real crawl-based check
-- of the client's own site for the on-page signals AI engines are known to
-- rely on, scored 0-100, plus an AI-drafted FAQ block addressing the gaps
-- found — the client adds it to their own site.
create table public.aeo_audits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  score int not null check (score between 0 and 100),
  findings jsonb not null default '[]'::jsonb,
  faq_draft text,
  audited_at timestamptz not null default now(),
  triggered_by uuid references public.profiles (id)
);

create index aeo_audits_org_id_idx on public.aeo_audits (org_id, audited_at desc);
