-- Digital Command — tenant isolation + admin-column protection test
-- Paste the WHOLE file into the Supabase SQL Editor and Run. Needs no passwords.
--
-- SAFE: changes nothing. Everything runs inside one DO block that ends by
-- raising an exception, so the database rolls the whole thing back. That final
-- "error" IS the test report — read the text under "TENANT ISOLATION TEST REPORT".
--
-- What it does: for two real client accounts (edit the two emails below if you
-- want other accounts), it pretends to be each one (role "authenticated" with
-- that user's id, exactly how the app's RLS sees a logged-in client) and
-- checks that they can neither READ nor WRITE any row belonging to the other
-- client, in every public table that has an org_id column. It also runs
-- "positive controls" (each user CAN see their own org) so a broken
-- simulation can't produce a false PASS.
--
-- How the write check works: it tries `update ... where org_id = <other org>`.
-- Postgres applies the SELECT policy to any UPDATE that reads a column, so a
-- write hole is reported when the other client's row is both visible and
-- updatable. That is the case an ordinary API call can reach (it filters on a
-- column, e.g. ?org_id=eq.<id>); a policy that allowed updates but not reads
-- would not be exercised by this test.
--
-- Verified before it was handed over: run against all 36 migrations loaded into
-- a scratch Postgres with rows for both tenants in every org table — PASS on the
-- real policies, "VULNERABLE" before migration 0034 and "PROTECTED" after, and
-- it correctly reports LEAK when a read or write hole is deliberately added.
--
-- Not covered: Supabase Storage bucket policies (storage.objects) — test those
-- separately.
do $$
declare
  email_a constant text := 'kavita.grover.441981@gmail.com';    -- Aura Lux Chocolate Co.
  email_b constant text := 'vineet.eventsncreations@gmail.com'; -- Vineet Events Creation
  user_a uuid;
  user_b uuid;
  org_a uuid;
  org_b uuid;
  tbls text[];
  t text;
  dir int;
  viewer uuid;
  own_org uuid;
  other_org uuid;
  who text;
  n bigint;
  rc bigint;
  report text := '';
  total_leaks int := 0;
  invalid boolean := false;
  admin_col_status text := 'not tested';
  client_write_status text := 'not tested';
begin
  select id into user_a from auth.users where email = email_a;
  select id into user_b from auth.users where email = email_b;
  select org_id into org_a from public.organization_members where user_id = user_a limit 1;
  select org_id into org_b from public.organization_members where user_id = user_b limit 1;
  if user_a is null or user_b is null or org_a is null or org_b is null then
    raise exception 'SETUP PROBLEM: could not resolve both accounts/orgs (user_a=%, user_b=%, org_a=%, org_b=%)',
      user_a, user_b, org_a, org_b;
  end if;

  select array_agg(distinct c.table_name order by c.table_name) into tbls
  from information_schema.columns c
  join information_schema.tables tb
    on tb.table_schema = c.table_schema and tb.table_name = c.table_name
  where c.table_schema = 'public' and c.column_name = 'org_id' and tb.table_type = 'BASE TABLE';

  for dir in 1..2 loop
    if dir = 1 then
      viewer := user_a; own_org := org_a; other_org := org_b; who := 'Aura Lux -> Vineet Events';
    else
      viewer := user_b; own_org := org_b; other_org := org_a; who := 'Vineet Events -> Aura Lux';
    end if;
    report := report || format(E'\n[%s]\n', who);

    perform set_config('request.jwt.claim.sub', viewer::text, true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', viewer::text, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    -- positive controls: the simulated user must see their OWN org
    select count(*) into n from public.organizations where id = own_org;
    if n <> 1 then
      invalid := true;
      report := report || format(E'  ! control failed: own organization row not visible (%s)\n', n);
    end if;
    select count(*) into n from public.organization_members where org_id = own_org;
    if n < 1 then
      invalid := true;
      report := report || E'  ! control failed: own membership row not visible\n';
    end if;

    -- cross-tenant: the other client's organization row
    select count(*) into n from public.organizations where id = other_org;
    if n > 0 then
      total_leaks := total_leaks + 1;
      report := report || E'  LEAK (read): other tenant''s organizations row is visible\n';
    end if;

    foreach t in array tbls loop
      begin
        execute format('select count(*) from public.%I where org_id = $1', t) into n using other_org;
        if n > 0 then
          total_leaks := total_leaks + 1;
          report := report || format(E'  LEAK (read): %s shows %s row(s) of the other tenant\n', t, n);
        end if;
      exception when insufficient_privilege then
        null; -- no access at all is fine
      end;

      begin
        execute format('update public.%I set org_id = org_id where org_id = $1', t) using other_org;
        get diagnostics rc = row_count;
        if rc > 0 then
          total_leaks := total_leaks + 1;
          report := report || format(E'  LEAK (write): %s let this user update %s row(s) of the other tenant\n', t, rc);
        end if;
      exception when others then
        null; -- blocked by permission or trigger is fine
      end;
    end loop;

    if dir = 1 then
      -- admin-only column: can a client flip their own premium flag?
      begin
        update public.client_settings
          set premium_apify_enabled = not premium_apify_enabled
          where org_id = own_org;
        get diagnostics rc = row_count;
        if rc > 0 then
          admin_col_status := 'VULNERABLE - a client CAN change premium_apify_enabled on their own account';
        else
          admin_col_status := 'blocked (0 rows updated)';
        end if;
      exception when others then
        admin_col_status := 'PROTECTED - blocked with: ' || sqlerrm;
      end;

      -- a normal client-writable column must still work (no regression)
      begin
        update public.client_settings
          set google_review_link = google_review_link
          where org_id = own_org;
        get diagnostics rc = row_count;
        if rc = 1 then
          client_write_status := 'OK - client-writable settings still work';
        else
          client_write_status := format('PROBLEM - expected 1 row, got %s', rc);
        end if;
      exception when others then
        client_write_status := 'PROBLEM - ' || sqlerrm;
      end;
    end if;

    execute 'reset role';
  end loop;

  raise exception E'\n===== TENANT ISOLATION TEST REPORT (nothing was changed) =====\nTables checked (have an org_id column): %\nCross-tenant leaks found: %\n%\nAdmin-only column write (premium_apify_enabled): %\nClient-writable column write: %\n\nRESULT: %\n',
    array_length(tbls, 1),
    total_leaks,
    report,
    admin_col_status,
    client_write_status,
    case
      when invalid then 'TEST INVALID - identity simulation failed, do not trust this result'
      when total_leaks = 0 then 'PASS - no cross-tenant read or write was possible'
      else 'FAIL - see the LEAK lines above'
    end;
end $$;
