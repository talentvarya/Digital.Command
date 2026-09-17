-- Digital Command — Buffer post insights (engagement metrics for published posts)
-- Run after 0032_phase12_apify_rls.sql.
--
-- Buffer's GraphQL API exposes a Post.metrics field (array of {type, name,
-- value, unit}, normalized across networks — reactions/comments are the
-- baseline, richer fields like impressions/reach/engagementRate appear when
-- the specific network supports them) — confirmed against developers.buffer.com's
-- own examples before writing this, not guessed. Synced on demand (client
-- clicks "Refresh insights" on a published post), same no-cron discipline as
-- every other sync in this app (checkPublishStatusAction, Search Console, etc.).
alter table public.content_items
  add column if not exists insights jsonb not null default '[]'::jsonb,
  add column if not exists insights_synced_at timestamptz;
