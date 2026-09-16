-- Digital Command — roadmap_leads gains a language column.
-- Run after 0025_phase9_roadmap_leads_rls.sql.
--
-- The public /roadmap page now offers English (default) and Hinglish, so
-- Super Admin can see which language a lead saw their roadmap in when
-- following up.
alter table public.roadmap_leads
  add column if not exists language text not null default 'en' check (language in ('en', 'hi'));
