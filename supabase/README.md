# Digital Command — Supabase setup

## 1. Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**. Free tier is fine to start.
2. **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, keep secret)
3. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com) → `ANTHROPIC_API_KEY` (server-only). Powers the 7-Day Planner's AI caption generation (Phase 2).

Copy `../.env.example` to `../.env.local` and fill these in.

## 2. Run the migrations, in order

**SQL Editor → New Query**, paste and run each file in this exact order (they depend on each other):

1. `migrations/0001_schema.sql` — tables, enums, triggers
2. `migrations/0002_rls.sql` — row-level security policies
3. `migrations/0003_storage.sql` — private storage buckets + policies
4. `migrations/0004_seed.sql` — plan pricing + draft policy text
5. `migrations/0005_phase2_schema.sql` — Brand Brain, links, planner, notifications tables
6. `migrations/0006_phase2_rls.sql` — Phase 2 row-level security policies
7. `migrations/0007_phase2_storage.sql` — Phase 2 storage buckets + policies

(Equivalently, if you use the Supabase CLI: `supabase db push` after linking the project, with these files under `supabase/migrations/`.)

## 3. Create the first Super Admin

There is no self-serve Super Admin signup — by design, every new signup becomes a `client_owner`.

1. **Authentication → Users → Add User** — enter your email/password, check **Auto Confirm User**.
2. **SQL Editor**, run:
   ```sql
   update public.profiles set role = 'super_admin' where id = '<the new user's UUID from step 1>';
   ```
3. Log in at `/login`. On first Super Admin login you'll be required to enroll TOTP MFA (via `/admin/mfa-setup`) before reaching the admin dashboard — this is mandatory per the spec and uses Supabase Auth's built-in MFA, no third-party service needed.

## 4. Verify isolation

After registering two separate test client accounts, confirm each can only see their own organization's data (this is what the RLS policies in `0002_rls.sql` enforce) — this is the most important thing to check before onboarding a real client.

## What's NOT included yet

- Real KYC/Aadhaar/PAN verification API — only stores uploaded documents for a human (Super Admin) to review. Wiring a verification provider is an open item in the master spec (§37.1/§37.2).
- Email receipts/notifications (spec §20) — deferred to a later phase; the audit log + in-app `notifications` table are the record for now.
- Final legal-reviewed policy text — `0004_seed.sql` seeds clearly-labeled DRAFT placeholder copy.
- Actual publishing to Facebook/Instagram/YouTube — the 7-Day Planner's realistic terminal state is `scheduled`, not `published` (Phase 4/Buffer).
- Unattended/cron-based Autopilot — generation is on-demand (button click) until a hosting decision unlocks a serverless cron (spec §37.3 is still open).
