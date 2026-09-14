-- Digital Command — Phase 6 Row Level Security
-- Run after 0014_phase6_schema.sql.
--
-- Note on threat model: unlike every OAuth/API-key connection table in this
-- app, nothing about paid_campaigns' status field can trigger real spend —
-- "launch" is always a manual, external, human action (see ARCHITECTURE.md).
-- So client write access is kept simple (full CRUD on their own org's rows,
-- same as brand_profiles/content_items) rather than column-locked the way
-- profiles.role or notifications.read are — there's no real-money property
-- to protect at the RLS layer here, only workflow bookkeeping. The "editing
-- an approved campaign resets it to pending_approval" rule lives in the
-- server action, the same deliberate choice already made for content_items'
-- `locked` column in Phase 2.

alter table public.paid_campaigns enable row level security;

create policy paid_campaigns_select on public.paid_campaigns
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy paid_campaigns_insert on public.paid_campaigns
  for insert with check (public.is_org_member(org_id));
create policy paid_campaigns_update_owner on public.paid_campaigns
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy paid_campaigns_update_admin on public.paid_campaigns
  for update using (public.is_super_admin()) with check (public.is_super_admin());
create policy paid_campaigns_delete on public.paid_campaigns
  for delete using (public.is_org_member(org_id) and status = 'draft');

alter table public.paid_campaign_approvals enable row level security;

create policy paid_campaign_approvals_select on public.paid_campaign_approvals
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy paid_campaign_approvals_insert on public.paid_campaign_approvals
  for insert with check (public.is_org_member(org_id) and approved_by = auth.uid());
