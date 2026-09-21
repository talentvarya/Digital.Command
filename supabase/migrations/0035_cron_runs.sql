-- Digital Command — cron run log
-- Run after 0034_protect_client_settings_admin_columns.sql.
--
-- The nightly Autopilot job silently failed for days (missing service-role key,
-- then a missing CRON_SECRET) and nothing surfaced it — the only signal was
-- content not appearing. Each run now records whether it worked, and the admin
-- Config Health page shows the last run per job and flags a failed or overdue
-- one. Written only by server code using the service-role key (no insert
-- policy for any logged-in role); readable by Super Admin only.
create table public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  summary jsonb not null default '{}'::jsonb,
  error text
);

create index cron_runs_job_ran_at_idx on public.cron_runs (job, ran_at desc);

alter table public.cron_runs enable row level security;

create policy cron_runs_admin_select on public.cron_runs
  for select using (public.is_super_admin());
