-- Digital Command — Phase 8 schema: Reputation Management
-- Run after 0021_autopilot_platforms.sql.
--
-- Real Google/Facebook review posting needs Google Business Profile API
-- access (a 60+ day verified profile + formal access request, review, and
-- rejections are common — the same external gate that's blocked Local
-- SEO/GBP since Phase 4, see PROJECT_PLAN.md). So this is scoped to what's
-- actually buildable today: the client logs a review request they sent
-- (through their own WhatsApp/SMS/email — Digital Command only builds the
-- pre-filled message), and logs a review they received by hand (no live
-- feed yet), AI drafts a reply, and the client posts it themselves and
-- marks it done — the same draft-here-send-yourself discipline Phase 5's
-- outreach_messages already uses.

-- ============================================================================
-- review_requests — a logged ask for a review. Digital Command never sends
-- anything itself; it only builds the pre-filled WhatsApp/SMS/email message.
-- ============================================================================
create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  contact_name text not null,
  contact_phone text,
  contact_email text,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email')),
  message_sent text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index review_requests_org_id_idx on public.review_requests (org_id);

-- ============================================================================
-- reviews — a review the client received, logged by hand (no live Google/FB
-- review feed without GBP API access — see header comment above). AI drafts
-- a reply; the client copies it onto the real platform and marks it posted.
-- ============================================================================
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  platform text not null default 'google' check (platform in ('google', 'facebook', 'other')),
  reviewer_name text,
  rating int check (rating between 1 and 5),
  review_text text,
  review_date date,
  ai_reply_draft text,
  reply_status text not null default 'needs_reply' check (reply_status in ('needs_reply', 'drafted', 'posted')),
  replied_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_org_id_idx on public.reviews (org_id);

-- ============================================================================
-- client_settings — the client's own Google/Facebook review page URLs, so
-- request messages and the reviews page can link straight to them.
-- ============================================================================
alter table public.client_settings
  add column if not exists google_review_link text,
  add column if not exists facebook_review_link text;

-- ============================================================================
-- ai_usage_events — widen the feature check to cover review-reply drafting,
-- same pattern as 0020's provider widening. Constraint name here follows
-- Postgres's default <table>_<column>_check naming (confirmed for the
-- sibling `provider` column in 0020's own comment) — if this errors with
-- "constraint does not exist", check pg_constraint for the real name and
-- swap it in before re-running.
-- ============================================================================
alter table public.ai_usage_events
  drop constraint ai_usage_events_feature_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_feature_check
  check (feature in (
    'content_generation', 'report_narrative', 'opportunity_assessment',
    'outreach_draft', 'campaign_brief', 'assistant_chat', 'review_reply_draft'
  ));
