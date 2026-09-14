-- Digital Command — Phase 7 schema: AI Assistant, Conversion Tracking,
-- Backup/Rollback, Connection Health, Master STOP/Emergency Freeze,
-- Offboarding, Cost Dashboard, Sandbox marker.
-- Run after 0015_phase6_rls.sql.
--
-- Includes two pre-existing-bug fixes surfaced while building this phase
-- (see BUILD_PROGRESS.md / SECURITY_AND_RLS.md for the full story):
--   1. client_settings.master_stop defaulted to true since Phase 1 and was
--      never read/written by any code — about to become load-bearing, so its
--      default must flip to false (not stopped) before anything reads it.
--   2. content_items/google_connections had no Super Admin write path at all
--      (offboarding needs one, narrowly — see 0017's RLS for the real
--      restriction, which lives in the action code, not the grant).

-- ----------------------------------------------------------------------------
-- Bug fix 1: master_stop must default to "not stopped"
-- ----------------------------------------------------------------------------
alter table public.client_settings alter column master_stop set default false;
update public.client_settings set master_stop = false where master_stop = true;

-- ----------------------------------------------------------------------------
-- client_settings — manual cost-entry fields (§30). Master STOP itself needs
-- no new column, just the default fix above plus real RLS/app wiring.
-- ----------------------------------------------------------------------------
alter table public.client_settings
  add column manual_buffer_cost_usd numeric(12, 2),
  add column manual_storage_cost_usd numeric(12, 2),
  add column manual_other_cost_usd numeric(12, 2),
  add column manual_other_cost_label text;

-- ----------------------------------------------------------------------------
-- system_settings — single-row platform-wide switch (Emergency Freeze, §28).
-- Singleton enforced by a boolean primary key + check(id) — only id=true can
-- ever exist, so there is exactly one row, always found the same way.
-- ----------------------------------------------------------------------------
create table public.system_settings (
  id boolean primary key default true,
  emergency_freeze boolean not null default false,
  frozen_by uuid references public.profiles (id),
  frozen_at timestamptz,
  frozen_reason text,
  updated_at timestamptz not null default now(),
  constraint system_settings_singleton check (id)
);

insert into public.system_settings default values;

-- ----------------------------------------------------------------------------
-- organizations — offboarded status (§29) + sandbox marker (§31)
-- ----------------------------------------------------------------------------
alter table public.organizations drop constraint organizations_status_check;
alter table public.organizations
  add constraint organizations_status_check
  check (status in ('draft', 'pending_approval', 'active', 'paused', 'expired', 'rejected', 'offboarded'));

alter table public.organizations add column is_sandbox boolean not null default false;

-- ----------------------------------------------------------------------------
-- content_versions — new writers: the AI assistant and version-restore (§17, §24)
-- ----------------------------------------------------------------------------
alter table public.content_versions drop constraint content_versions_generated_by_check;
alter table public.content_versions
  add constraint content_versions_generated_by_check
  check (generated_by in ('ai', 'client_suggestion', 'client_edit', 'admin', 'gpt_assistant', 'restored'));

alter table public.content_versions add column restored_from_version int;

-- ----------------------------------------------------------------------------
-- ai_usage_events — append-only, real per-call token/cost tracking (§30).
-- Deliberately NOT client-readable — see 0017's RLS comment.
-- ----------------------------------------------------------------------------
create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  feature text not null check (feature in (
    'content_generation', 'report_narrative', 'opportunity_assessment',
    'outreach_draft', 'campaign_brief', 'assistant_chat'
  )),
  input_tokens int not null,
  output_tokens int not null,
  estimated_cost_usd numeric(12, 6) not null,
  created_at timestamptz not null default now()
);

create index ai_usage_events_org_id_idx on public.ai_usage_events (org_id);

-- ----------------------------------------------------------------------------
-- conversion_links / conversion_events (§22)
-- ----------------------------------------------------------------------------
create table public.conversion_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  type text not null check (type in ('whatsapp', 'phone', 'form', 'booking', 'other')),
  label text not null,
  destination text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index conversion_links_org_id_idx on public.conversion_links (org_id);

-- Append-only. link_id is null for a manually-logged conversion not tied to
-- a tracked link (e.g. a sale reported over the phone).
create table public.conversion_events (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.conversion_links (id) on delete set null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null check (event_type in ('click', 'lead', 'sale', 'booking')),
  value numeric(12, 2),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  notes text,
  created_at timestamptz not null default now()
);

create index conversion_events_org_id_idx on public.conversion_events (org_id);
create index conversion_events_link_id_idx on public.conversion_events (link_id);

-- A public, anonymous click can arrive with any org_id it likes in the
-- payload — this trigger derives the real org_id from the referenced link
-- server-side whenever a link is involved, so the anon INSERT policy (0017)
-- never has to trust the request's own claim about which org a click
-- belongs to. Manual (link_id is null) inserts are left as the caller set
-- them — those only ever happen through an already is_org_member-checked
-- server action, so org_id is trustworthy there.
create function public.set_conversion_event_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.link_id is not null then
    select org_id into new.org_id from public.conversion_links where id = new.link_id;
  end if;
  return new;
end;
$$;

create trigger before_conversion_event_insert
  before insert on public.conversion_events
  for each row execute function public.set_conversion_event_org_id();
