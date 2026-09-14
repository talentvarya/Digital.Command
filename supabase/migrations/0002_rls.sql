-- Digital Command — Row Level Security
-- Run after 0001_schema.sql.

-- ============================================================================
-- Helper functions (security definer so they can read profiles/membership
-- without recursing into the RLS policies that call them)
-- ============================================================================
create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'super_admin'
  );
$$;

create function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = target_org and user_id = auth.uid()
  );
$$;

-- ============================================================================
-- profiles
-- ============================================================================
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());

create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

-- Column-level lock: clients may update their own display name but never
-- their own role. Only a super admin (via a service context or explicit
-- grant) can change role; day-to-day the app never exposes a role editor.
revoke update on public.profiles from authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;

-- ============================================================================
-- organizations
-- ============================================================================
alter table public.organizations enable row level security;

create policy organizations_select on public.organizations
  for select using (public.is_org_member(id) or public.is_super_admin());

create policy organizations_insert on public.organizations
  for insert with check (created_by = auth.uid());

create policy organizations_update_owner on public.organizations
  for update
  using (public.is_org_member(id) and status = 'draft')
  with check (public.is_org_member(id) and status in ('draft', 'pending_approval'));

create policy organizations_update_admin on public.organizations
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ============================================================================
-- organization_members
-- ============================================================================
alter table public.organization_members enable row level security;

create policy organization_members_select on public.organization_members
  for select using (public.is_org_member(org_id) or public.is_super_admin());

create policy organization_members_insert_self on public.organization_members
  for insert
  with check (
    user_id = auth.uid()
    and member_role = 'owner'
    and exists (
      select 1 from public.organizations o
      where o.id = org_id and o.created_by = auth.uid()
    )
  );

create policy organization_members_admin on public.organization_members
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ============================================================================
-- plans (public pricing — readable by anyone signed in; managed by admin only)
-- ============================================================================
alter table public.plans enable row level security;

create policy plans_select on public.plans for select using (true);
create policy plans_admin_write on public.plans
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ============================================================================
-- subscriptions
-- ============================================================================
alter table public.subscriptions enable row level security;

create policy subscriptions_select on public.subscriptions
  for select using (public.is_org_member(org_id) or public.is_super_admin());

create policy subscriptions_insert on public.subscriptions
  for insert with check (public.is_org_member(org_id) and status = 'pending');

create policy subscriptions_admin_update on public.subscriptions
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ============================================================================
-- policy_versions (public read so Terms etc. can be shown pre-registration)
-- ============================================================================
alter table public.policy_versions enable row level security;

create policy policy_versions_select on public.policy_versions for select using (true);
create policy policy_versions_admin_write on public.policy_versions
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ============================================================================
-- consent_records (immutable — no update/delete policy for anyone)
-- ============================================================================
alter table public.consent_records enable row level security;

create policy consent_records_select on public.consent_records
  for select using (public.is_org_member(org_id) or public.is_super_admin());

create policy consent_records_insert on public.consent_records
  for insert with check (user_id = auth.uid() and public.is_org_member(org_id));

-- ============================================================================
-- business_verifications
-- ============================================================================
alter table public.business_verifications enable row level security;

create policy business_verifications_select on public.business_verifications
  for select using (public.is_org_member(org_id) or public.is_super_admin());

create policy business_verifications_insert on public.business_verifications
  for insert with check (public.is_org_member(org_id) and status in ('draft', 'submitted'));

create policy business_verifications_update_owner on public.business_verifications
  for update
  using (public.is_org_member(org_id) and status in ('draft', 'more_documents_required'))
  with check (public.is_org_member(org_id) and status = 'submitted');

create policy business_verifications_update_admin on public.business_verifications
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ============================================================================
-- verification_documents (append-only — no update/delete policy)
-- ============================================================================
alter table public.verification_documents enable row level security;

create policy verification_documents_select on public.verification_documents
  for select using (public.is_org_member(org_id) or public.is_super_admin());

create policy verification_documents_insert on public.verification_documents
  for insert with check (public.is_org_member(org_id) and uploaded_by = auth.uid());

-- ============================================================================
-- payments
-- ============================================================================
alter table public.payments enable row level security;

create policy payments_select on public.payments
  for select using (public.is_org_member(org_id) or public.is_super_admin());

create policy payments_insert on public.payments
  for insert with check (public.is_org_member(org_id) and status = 'pending_verification');

create policy payments_admin_update on public.payments
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ============================================================================
-- client_settings (created only by the activation trigger, which runs as
-- security definer and therefore bypasses RLS; no insert policy needed)
-- ============================================================================
alter table public.client_settings enable row level security;

create policy client_settings_select on public.client_settings
  for select using (public.is_org_member(org_id) or public.is_super_admin());

create policy client_settings_admin_update on public.client_settings
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ============================================================================
-- audit_logs — append-only. Deliberately no update/delete policy for any role.
-- ============================================================================
alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs
  for select using (
    public.is_super_admin()
    or (org_id is not null and public.is_org_member(org_id))
  );

create policy audit_logs_insert on public.audit_logs
  for insert with check (actor_user_id = auth.uid() or public.is_super_admin());
