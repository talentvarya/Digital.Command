import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { applyMigrations, migrationFiles, newDb, runIsolationReport, runMigration, seedTwoTenants } from "./helpers/pg-harness";

// Runs the real migrations in an in-memory Postgres — see helpers/pg-harness.ts
// for what this does and does not prove. Slow by this suite's standards (a few
// seconds), hence the generous timeouts.
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

  // 0033-0036 are handed over as one combined paste and may be run twice.
  it("can re-run the re-runnable migrations (0033-0036) without error", async () => {
    for (const f of migrationFiles().filter((name) => /^003[3-6]_/.test(name))) {
      await runMigration(db, f);
    }
  }, 60_000);
});
