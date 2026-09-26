-- Digital Command — Customers & WhatsApp lists
-- Run after 0038_content_image_prompt.sql. Safe to run more than once.
--
-- A business's own customer list: name, WhatsApp number, tags, and whether the
-- customer agreed to hear from the business. The client opens each WhatsApp
-- message and presses send themselves — nothing is sent from here.
--
-- Privacy: these are a client's CUSTOMERS' details, so only members of that
-- business can read or change them. There is deliberately no Super Admin read
-- policy (unlike most tables) — support has no need to see them.
create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  -- digits with the country code and no "+", e.g. 919876543210 (WhatsApp's link format)
  phone text not null,
  tags text[] not null default '{}',
  notes text,
  -- the customer agreed to receive messages from this business
  consent boolean not null default false,
  consent_note text,
  consent_at timestamptz,
  -- the customer later asked to stop; overrides consent
  opted_out boolean not null default false,
  opted_out_at timestamptz,
  last_messaged_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, phone)
);

create index if not exists customer_contacts_org_idx on public.customer_contacts (org_id, created_at desc);

alter table public.customer_contacts enable row level security;

drop policy if exists customer_contacts_select on public.customer_contacts;
create policy customer_contacts_select on public.customer_contacts
  for select using (public.is_org_member(org_id));

drop policy if exists customer_contacts_insert on public.customer_contacts;
create policy customer_contacts_insert on public.customer_contacts
  for insert with check (public.is_org_member(org_id));

drop policy if exists customer_contacts_update on public.customer_contacts;
create policy customer_contacts_update on public.customer_contacts
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists customer_contacts_delete on public.customer_contacts;
create policy customer_contacts_delete on public.customer_contacts
  for delete using (public.is_org_member(org_id));
