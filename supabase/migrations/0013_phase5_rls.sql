-- Digital Command — Phase 5 Row Level Security
-- Run after 0012_phase5_schema.sql.

alter table public.off_page_opportunities enable row level security;

create policy off_page_opportunities_select on public.off_page_opportunities
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy off_page_opportunities_insert on public.off_page_opportunities
  for insert with check (public.is_org_member(org_id));
create policy off_page_opportunities_update on public.off_page_opportunities
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy off_page_opportunities_delete on public.off_page_opportunities
  for delete using (public.is_org_member(org_id));

alter table public.outreach_messages enable row level security;

create policy outreach_messages_select on public.outreach_messages
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy outreach_messages_insert on public.outreach_messages
  for insert with check (public.is_org_member(org_id));
create policy outreach_messages_update on public.outreach_messages
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

alter table public.brand_mention_searches enable row level security;

create policy brand_mention_searches_select on public.brand_mention_searches
  for select using (public.is_org_member(org_id) or public.is_super_admin());
create policy brand_mention_searches_insert on public.brand_mention_searches
  for insert with check (public.is_org_member(org_id));
