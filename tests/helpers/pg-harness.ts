// Loads the real migrations into an in-memory Postgres (PGlite) behind minimal
// stand-ins for the parts of Supabase the schema leans on (the auth and storage
// schemas and the anon / authenticated / service_role roles). That lets every
// push prove two things a type-check can't: each migration applies cleanly, and
// one client still cannot read or write another client's rows.
//
// It tests the migrations, not the live project — if the live database was ever
// changed by hand, only running supabase/tests/tenant_isolation_test.sql there
// can see that.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUPABASE_DIR = fileURLToPath(new URL("../../supabase/", import.meta.url));
const MIGRATIONS_DIR = path.join(SUPABASE_DIR, "migrations");

export const ISOLATION_TEST_SQL = fs.readFileSync(path.join(SUPABASE_DIR, "tests", "tenant_isolation_test.sql"), "utf8");

// The two accounts tenant_isolation_test.sql impersonates (its email_a / email_b).
const EMAIL_A = "kavita.grover.441981@gmail.com";
const EMAIL_B = "vineet.eventsncreations@gmail.com";

const SUPABASE_STAND_INS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid
  $$;

  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
  $$;

  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  grant select on auth.users to service_role;
  grant all on storage.objects, storage.buckets to authenticated, service_role;
`;

export async function newDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STAND_INS);
  return db;
}

export function migrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

// pgcrypto isn't shipped with PGlite and nothing needs it (gen_random_uuid() is core).
export function readMigration(file: string): string {
  return fs
    .readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
    .replace(/create extension if not exists "pgcrypto";/i, "-- (pgcrypto skipped in this harness)");
}

export async function runMigration(db: PGlite, file: string): Promise<void> {
  try {
    await db.exec(readMigration(file));
  } catch (err) {
    throw new Error(`Migration ${file} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function applyMigrations(db: PGlite, only: (file: string) => boolean = () => true): Promise<string[]> {
  const files = migrationFiles().filter(only);
  for (const f of files) await runMigration(db, f);
  return files;
}

interface FkRow { tbl: string; col: string; reftbl: string; refcol: string }
interface CheckRow { tbl: string; def: string }
interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_generated: string;
  is_identity: string;
}

// One row per org-scoped table for each of two clients, so a cross-tenant leak
// would actually have something to leak. Returns any table it could not fill —
// for those, "no leak found" would be vacuous, and the test asserts there are none.
export async function seedTwoTenants(db: PGlite): Promise<{ tables: string[]; unseeded: string[] }> {
  const userId = async (email: string) =>
    (await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email])).rows[0].id;
  const ua = await userId(EMAIL_A);
  const ub = await userId(EMAIL_B);
  const org = async (name: string, owner: string) =>
    (
      await db.query<{ id: string }>(
        `insert into public.organizations (legal_name, business_type, status, created_by) values ($1, 'proprietorship', 'active', $2) returning id`,
        [name, owner]
      )
    ).rows[0].id;
  const oa = await org("Aura Lux Chocolate Co. (test)", ua);
  const ob = await org("Vineet Events Creation (test)", ub);
  await db.query(`insert into public.organization_members (org_id, user_id, member_role) values ($1, $2, 'owner'), ($3, $4, 'owner')`, [oa, ua, ob, ub]);

  const tables = (
    await db.query<{ table_name: string }>(`
      select distinct c.table_name
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'org_id' and tb.table_type = 'BASE TABLE'
      order by 1`)
  ).rows.map((r) => r.table_name);

  const fks = (
    await db.query<FkRow>(`
      select c.conrelid::regclass::text as tbl, a.attname as col, c.confrelid::regclass::text as reftbl, af.attname as refcol
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
      where c.contype = 'f' and array_length(c.conkey, 1) = 1 and c.connamespace = 'public'::regnamespace`)
  ).rows;
  const checks = (
    await db.query<CheckRow>(
      `select conrelid::regclass::text as tbl, pg_get_constraintdef(oid) as def from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace`
    )
  ).rows;
  const orgTables = new Set(tables);

  async function insertRow(t: string, orgId: string, owner: string) {
    const cols = (
      await db.query<ColumnRow>(
        `select column_name, data_type, is_nullable, column_default, is_generated, is_identity
         from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`,
        [t]
      )
    ).rows;
    const names: string[] = [];
    const values: string[] = [];
    for (const c of cols) {
      if (c.column_name === "org_id") {
        names.push("org_id");
        values.push(`'${orgId}'`);
        continue;
      }
      if (c.is_nullable === "YES" || c.column_default !== null || c.is_generated === "ALWAYS" || c.is_identity === "YES") continue;
      const fk = fks.find((f) => f.tbl === t && f.col === c.column_name);
      let v: string | null = null;
      if (fk) {
        const ref = fk.reftbl.replace(/^public\./, "");
        v = ref === "profiles" ? `'${owner}'` : `(select ${fk.refcol} from ${fk.reftbl}${orgTables.has(ref) ? ` where org_id = '${orgId}'` : ""} limit 1)`;
      } else if (c.data_type === "uuid") v = "gen_random_uuid()";
      else if (c.data_type === "text" || c.data_type === "character varying") {
        const chk = checks.find((k) => k.tbl === t && k.def.includes(c.column_name) && k.def.includes("ARRAY["));
        const lit = chk ? chk.def.slice(chk.def.indexOf("ARRAY[")).match(/'([^']+)'/) : null;
        v = lit ? `'${lit[1]}'` : `'x'`;
      } else if (["integer", "bigint", "smallint", "numeric"].includes(c.data_type)) v = "1";
      else if (c.data_type === "boolean") v = "false";
      else if (c.data_type === "jsonb" || c.data_type === "json") v = `'{}'`;
      else if (c.data_type === "date") v = "current_date";
      else if (c.data_type.startsWith("timestamp")) v = "now()";
      else if (c.data_type.startsWith("time")) v = `'09:00'`;
      else if (c.data_type === "ARRAY") v = `'{}'`;
      if (v === null) throw new Error(`no seed rule for ${t}.${c.column_name} (${c.data_type})`);
      names.push(c.column_name);
      values.push(v);
    }
    await db.query(`insert into public.${t} (${names.join(", ")}) values (${values.join(", ")})`);
  }

  // Several passes: a table whose parent is seeded later succeeds on the next one.
  const done = new Set<string>();
  for (let pass = 0; pass < 5; pass++) {
    for (const t of tables) {
      for (const [orgId, owner, tag] of [[oa, ua, "A"], [ob, ub, "B"]] as const) {
        const key = `${t}:${tag}`;
        if (done.has(key)) continue;
        try {
          const { n } = (await db.query<{ n: number }>(`select count(*)::int as n from public.${t} where org_id = $1`, [orgId])).rows[0];
          if (n === 0) await insertRow(t, orgId, owner);
          done.add(key);
        } catch {
          // retried on the next pass; reported below if it never succeeds
        }
      }
    }
  }
  return { tables, unseeded: tables.filter((t) => !done.has(`${t}:A`) || !done.has(`${t}:B`)) };
}

// tenant_isolation_test.sql never raises: its last statement is a SELECT that
// returns the report one line per row. Pass `sql` to run it after other
// statements in the same query (how it gets pasted next to the migrations).
export async function runIsolationReport(db: PGlite, sql: string = ISOLATION_TEST_SQL): Promise<string> {
  const results = await db.exec(sql);
  const rows = (results[results.length - 1]?.rows ?? []) as { report: string }[];
  if (rows.length === 0) throw new Error("tenant_isolation_test.sql returned no report lines.");
  return rows.map((r) => r.report).join("\n");
}
