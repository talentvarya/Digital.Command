-- Digital Command — close the admin-only-column hole on client_settings
-- Run after 0033_buffer_post_insights.sql.
--
-- client_settings_owner_update (0017) is row-level: any org member can update
-- ANY column of their own org's row. Most columns are meant to be client-
-- writable (master_stop, review links, content mode, autopilot settings), but
-- a few are admin-only by design — premium_apify_enabled (a paid add-on gate),
-- the manual_* cost fields (entered on the admin Costs page), automation_status,
-- and org_id itself. RLS can't express column-level rules, so a BEFORE UPDATE
-- trigger enforces it: a logged-in session that is not a Super Admin can't
-- change those columns. auth.uid() is null for the service-role client (cron,
-- server jobs), so those are unaffected.
create or replace function public.protect_client_settings_admin_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    if new.org_id is distinct from old.org_id
       or new.automation_status is distinct from old.automation_status
       or new.manual_buffer_cost_usd is distinct from old.manual_buffer_cost_usd
       or new.manual_storage_cost_usd is distinct from old.manual_storage_cost_usd
       or new.manual_other_cost_usd is distinct from old.manual_other_cost_usd
       or new.manual_other_cost_label is distinct from old.manual_other_cost_label
       or new.premium_apify_enabled is distinct from old.premium_apify_enabled then
      raise exception 'Only a Super Admin can change this setting.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_client_settings_admin_columns on public.client_settings;
create trigger protect_client_settings_admin_columns
  before update on public.client_settings
  for each row execute function public.protect_client_settings_admin_columns();
