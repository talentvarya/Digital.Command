# Digital Command

**AI Digital Marketing Autopilot** — by Visionary Masters Global Pvt. Ltd.

Multi-tenant SaaS built with Next.js 14 (App Router) + TypeScript + TailwindCSS + Supabase (Auth, Postgres with Row Level Security, Storage). This is **Phase 1** of the build — see `PROJECT_PLAN.md` and `BUILD_PROGRESS.md`.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + keys
npm run dev
```

Before the app is usable end-to-end, set up Supabase — see [`supabase/README.md`](supabase/README.md) for the exact steps (run the migrations, create the first Super Admin, enroll MFA).

## What's here

| Doc | Contents |
|---|---|
| [`PROJECT_PLAN.md`](PROJECT_PLAN.md) | Phase breakdown, Phase 1 exit criteria, explicit non-goals |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Route map, registration→activation data flow, directory structure |
| [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) | Every Phase 1 table + what's deliberately not built yet |
| [`SECURITY_AND_RLS.md`](SECURITY_AND_RLS.md) | Role model, full RLS policy matrix, MFA, secrets handling |
| [`API_INTEGRATIONS.md`](API_INTEGRATIONS.md) | Inventory of future integrations and their planned phase |
| [`BUILD_PROGRESS.md`](BUILD_PROGRESS.md) | ✅/🟡/⬜/🔴/⚠️ status tracker |
| [`supabase/README.md`](supabase/README.md) | Manual Supabase project setup |

## Commands

```bash
npm run dev      # local dev server
npm run lint     # ESLint
npm run build    # production build + type check
npm run start    # run a production build
```
