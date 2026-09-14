-- Digital Command — widens ai_usage_events.provider to accept 'gemini' and
-- 'openai', added as two more switchable AI providers alongside Claude and
-- Kimi (see ARCHITECTURE.md — "AI Provider Abstraction").
--
-- Row-level, not column-level RLS as before (0019) — no RLS change needed,
-- same reasoning already documented in SECURITY_AND_RLS.md.
--
-- Constraint name confirmed against the live database before writing this
-- migration (pg_constraint), not assumed: ai_usage_events_provider_check.
alter table public.ai_usage_events
  drop constraint ai_usage_events_provider_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_provider_check
  check (provider in ('anthropic', 'kimi', 'gemini', 'openai'));
