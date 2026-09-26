import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  ISOLATION_TEST_SQL,
  applyMigrations,
  migrationFiles,
  newDb,
  readMigration,
  runIsolationReport,
  runMigration,
  seedTwoTenants,
} from "./helpers/pg-harness";

// Runs the real migrations in an in-memory Postgres — see helpers/pg-harness.ts
// for what this does and does not prove. Slow by this suite's standards (a few
// seconds per database), hence the generous timeouts.
const before0033 = (f: string) => f < "0033";
// 0033-0036 are the ones handed over as one paste; the isolation test is pasted right after them.
const pasteOfMigrationsAndTest = () =>
  [...migrationFiles().filter((f) => !before0033(f)).map(readMigration), ISOLATION_TEST_SQL].join("\n");

describe("database migrations and tenant isolation", () => {
  let db: PGlite;
  let tables: string[];

  beforeAll(async () => {
    db = await newDb();
    await applyMigrations(db); // a failing migration fails here, naming the file
    const seeded = await seedTwoTenants(db);
    tables = seeded.tables;
    expect(seeded.unseeded).toEqual([]); // otherwise "no leak" would be vacuous for those tables
  }, 120_000);

  it("applies every migration to a fresh database", () => {
    expect(migrationFiles().length).toBeGreaterThanOrEqual(36);
    expect(tables.length).toBeGreaterThan(30);
  });

  it("keeps two clients' data isolated and protects the admin-only settings", async () => {
    const report = await runIsolationReport(db);
    expect(report).toContain("Cross-tenant leaks found: 0");
    expect(report).toContain("PROTECTED");
    expect(report).toContain("OK - client-writable settings still work");
    expect(report).toContain("RESULT: PASS");
  }, 60_000);

  it("actually fails when isolation is broken (so a PASS means something)", async () => {
    await db.exec(`create policy zz_leak on public.content_items for select to authenticated using (true);`);
    try {
      const report = await runIsolationReport(db);
      expect(report).toContain("LEAK (read): content_items");
      expect(report).toContain("RESULT: FAIL");
    } finally {
      await db.exec(`drop policy zz_leak on public.content_items;`);
    }
  }, 60_000);

  it("leaves no trace — data and role are restored — even when a hole is open", async () => {
    await db.exec(`drop trigger protect_client_settings_admin_columns on public.client_settings;`);
    try {
      const flags = async () =>
        (await db.query(`select org_id, premium_apify_enabled from public.client_settings order by org_id`)).rows;
      const before = await flags();
      const report = await runIsolationReport(db);
      expect(report).toContain("VULNERABLE"); // the flip really went through inside the test...
      expect(await flags()).toEqual(before); // ...and was undone afterwards
      const { rows } = await db.query<{ current_user: string }>(`select current_user`);
      expect(rows[0].current_user).toBe("postgres");
    } finally {
      await runMigration(db, migrationFiles().find((f) => f.startsWith("0034_"))!); // put the trigger back
    }
  }, 60_000);

  // 0033-0036 are handed over as one combined paste and may be run twice.
  it("can re-run the re-runnable migrations (0033-0036) without error", async () => {
    for (const f of migrationFiles().filter((name) => /^003[3-6]_/.test(name))) {
      await runMigration(db, f);
    }
  }, 60_000);
});

// Customers' phone numbers are the most personal data in the product, so they get
// a check of their own on top of the generic one: another business can't read,
// add to, change or delete them — and neither can a Super Admin (deliberately).
describe("customer contacts privacy", () => {
  it("keeps a business's customers to that business alone", async () => {
    const d = await newDb();
    await applyMigrations(d);
    await seedTwoTenants(d);

    const orgs = (
      await d.query<{ id: string; created_by: string }>(`select id, created_by from public.organizations order by legal_name`)
    ).rows;
    const [a, b] = orgs; // Aura Lux (test), then Vineet Events (test)
    const admin = (await d.query<{ id: string }>(`insert into auth.users (email) values ('admin@example.test') returning id`)).rows[0].id;
    await d.query(`update public.profiles set role = 'super_admin' where id = $1`, [admin]);

    // Run as a signed-in user, then roll back so nothing stays changed.
    async function asUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
      await d.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${userId}', true);`);
      try {
        return await run();
      } finally {
        await d.exec(`rollback;`);
      }
    }

    // Each business has one seeded customer.
    await asUser(a.created_by, async () => {
      const seen = (await d.query<{ org_id: string }>(`select org_id from public.customer_contacts`)).rows;
      expect(seen.map((r) => r.org_id)).toEqual([a.id]);

      // adds to its own list...
      await d.query(`insert into public.customer_contacts (org_id, name, phone) values ($1, 'New customer', '919000000001')`, [a.id]);
      // ...but not into another business's
      await expect(
        d.query(`insert into public.customer_contacts (org_id, name, phone) values ($1, 'Planted', '919000000002')`, [b.id])
      ).rejects.toThrow(/row-level security/i);
    });

    await asUser(a.created_by, async () => {
      const changed = await d.query(`update public.customer_contacts set name = 'hacked' where org_id = $1 returning id`, [b.id]);
      expect(changed.rows).toHaveLength(0);
      const removed = await d.query(`delete from public.customer_contacts where org_id = $1 returning id`, [b.id]);
      expect(removed.rows).toHaveLength(0);
    });

    // A Super Admin can read most tables, but not a business's customers.
    await asUser(admin, async () => {
      const seen = await d.query(`select id from public.customer_contacts`);
      expect(seen.rows).toHaveLength(0);
    });

    // Nothing above changed the data.
    const total = (await d.query<{ n: number }>(`select count(*)::int as n from public.customer_contacts`)).rows[0].n;
    expect(total).toBe(2);
  }, 120_000);
});

// The owner pastes the migrations and the test into one query. That must both
// work and never let the test undo the migrations.
describe("pasting the migrations and the isolation test together", () => {
  it("passes, and the migrations are still there afterwards", async () => {
    const d = await newDb();
    await applyMigrations(d, before0033); // the live project's state before this paste
    await seedTwoTenants(d);
    const report = await runIsolationReport(d, pasteOfMigrationsAndTest());
    expect(report).toContain("RESULT: PASS");
    expect(report).toContain("PROTECTED");
    const { rows } = await d.query<{ ok: boolean }>(
      `select to_regclass('public.ai_visibility_checks') is not null
          and to_regclass('public.cron_runs') is not null
          and exists (select 1 from pg_trigger where tgname = 'protect_client_settings_admin_columns') as ok`
    );
    expect(rows[0].ok).toBe(true);
  }, 120_000);

  it("if the test cannot run it says so instead of raising, and the migrations still stay", async () => {
    const d = await newDb();
    await applyMigrations(d, before0033); // migrated, but no client accounts to test
    const report = await runIsolationReport(d, pasteOfMigrationsAndTest());
    expect(report).toContain("RESULT: NOT RUN");
    expect(report).toContain("SETUP PROBLEM");
    const { rows } = await d.query<{ ok: boolean }>(`select to_regclass('public.cron_runs') is not null as ok`);
    expect(rows[0].ok).toBe(true);
  }, 120_000);
});
