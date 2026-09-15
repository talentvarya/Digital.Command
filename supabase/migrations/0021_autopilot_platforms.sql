-- Digital Command — Autopilot platform selection + "Fill this week" bulk generate.
--
-- Autopilot mode (client_settings.content_control_mode = 'autopilot') already
-- auto-schedules whatever content a client generates — but generation itself
-- has always been one manual "Generate with AI" click per day per platform,
-- with no way to tell which platforms Autopilot is even meant to cover. This
-- adds an explicit, client-chosen platform list so Autopilot's scope is
-- visible in the UI instead of implicit, and a bulk action can fill the
-- current 7-day window for exactly those platforms in one click.
alter table public.client_settings
  add column if not exists autopilot_platforms text[] not null default '{}';
