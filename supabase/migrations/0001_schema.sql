-- Digital Command — Phase 1 schema
-- Run this after creating a fresh Supabase project (SQL Editor -> New Query -> paste -> Run),
-- then 0002_rls.sql, 0003_storage.sql, 0004_seed.sql in that order.

create extension if not exists "pgcrypto";

-- ============================================================================
-- profiles — one row per auth.users row, created automatically by trigger below
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'client_owner'
    check (role in ('super_admin', 'client_owner', 'client_user', 'client_viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- organizations — one row per registered client business
-- ============================================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  business_type text not null
    check (business_type in ('individual', 'proprietorship', 'partnership', 'private_limited', 'public_limited')),
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'active', 'paused', 'expired', 'rejected')),
  promo_opt_in boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'owner'
    check (member_role in ('owner', 'user', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- ============================================================================
-- plans / subscriptions
-- ============================================================================
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  websites_included int not null default 0,
  smo_packages_included int not null default 0,
  is_custom boolean not null default false,
  price_quarterly numeric(12, 2),
  price_half_yearly numeric(12, 2),
  price_yearly numeric(12, 2),
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  billing_term text not null check (billing_term in ('quarterly', 'half_yearly', 'yearly')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'cancelled')),
  start_date date,
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- policy versions + consent records (terms/consent gate, spec section 5)
-- ============================================================================
create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_type text not null
    check (policy_type in (
      'terms', 'privacy', 'package_scope', 'verification_consent',
      'marketing_authorization', 'data_retention', 'refund_cancellation',
      'audit_logging_consent', 'third_party_disclosure', 'authorized_representative'
    )),
  version text not null,
  title text not null,
  body text not null,
  is_current boolean not null default true,
  effective_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (policy_type, version)
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  policy_version_id uuid not null references public.policy_versions (id),
  accepted boolean not null default true,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- business verification + documents (spec section 4.2 / 4.3)
-- ============================================================================
create table public.business_verifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'pending_review', 'more_documents_required', 'approved', 'rejected')),
  details jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.business_verifications (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  doc_type text not null,
  storage_path text not null,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- payments (manual submission, spec section 7)
-- ============================================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  amount numeric(12, 2) not null,
  transaction_ref text not null,
  payment_date date not null,
  screenshot_path text,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'rejected')),
  submitted_at timestamptz not null default now(),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  reason text
);

-- ============================================================================
-- client settings — created automatically on activation
-- ============================================================================
create table public.client_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  automation_status text not null default 'not_started',
  master_stop boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- audit_logs — append-only action trail (spec section 19)
-- ============================================================================
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete set null,
  actor_user_id uuid references public.profiles (id),
  actor_role text,
  source text not null check (source in ('AUTOPILOT', 'CLIENT_MANUAL', 'ADMIN', 'GPT_ASSISTANT')),
  action_type text not null,
  target text,
  previous_state jsonb,
  new_state jsonb,
  result text not null default 'success' check (result in ('success', 'failure')),
  failure_reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_org_id_idx on public.audit_logs (org_id);
create index organization_members_user_id_idx on public.organization_members (user_id);
create index verification_documents_org_id_idx on public.verification_documents (org_id);
create index payments_org_id_idx on public.payments (org_id);

-- ============================================================================
-- activation trigger — when an org flips to 'active', create client_settings
-- and activate its subscription with computed start/expiry dates
-- ============================================================================
create function public.handle_org_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub record;
  months int;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    insert into public.client_settings (org_id)
    values (new.id)
    on conflict (org_id) do nothing;

    select * into sub from public.subscriptions where org_id = new.id order by created_at desc limit 1;
    if found then
      months := case sub.billing_term
        when 'quarterly' then 3
        when 'half_yearly' then 6
        when 'yearly' then 12
        else 3
      end;
      update public.subscriptions
      set status = 'active',
          start_date = current_date,
          expiry_date = current_date + (months || ' months')::interval,
          updated_at = now()
      where id = sub.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_organization_activated
  after update on public.organizations
  for each row execute function public.handle_org_activation();
