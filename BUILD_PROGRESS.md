# Digital Command — Build Progress

Last updated: Phase 1 initial build.

## Phase 1

### ✅ Completed (built and verified against the running app, no live Supabase project needed)

- Branding shell (landing page, packages/pricing display matching spec §6 exactly)
- Login / Forgot Password / Reset Password pages
- Registration Step 1 (account creation)
- Route guards (unauthenticated access to `/admin/*`, `/app/*`, `/pending`, `/register/details` redirects to `/login`)
- `npm run lint` — clean, no warnings/errors
- `npm run build` — clean production build, full TypeScript type check passes

### 🟡 Built, needs a live Supabase project to verify end-to-end

- Registration Step 2 (business type, package, verification documents, manual payment, all-mandatory-checkboxes consent gate)
- Business verification submission + document upload (private Storage bucket)
- Manual payment submission + optional screenshot upload
- Super Admin dashboard (stat cards + client table)
- Super Admin client review (approve / reject / request more documents, verify/reject payment, activate account — reason mandatory for reject/request-docs)
- Client `/pending` status tracker
- Client `/app/dashboard` post-activation shell
- Super Admin TOTP MFA enrollment (real Supabase Auth MFA, not a placeholder)
- Audit logging on every mutating action
- Multi-tenant RLS isolation (schema + policies written and reasoned through; **not yet tested against a real database** — this is the single most important thing to verify before onboarding any real client, see `supabase/README.md` §4)

### ⬜ Not started (out of Phase 1 scope per the build order)

- Brand Brain, 7-day content planner, Autopilot/Approval Required content flow (Phase 2)
- SEO/Search Console/Analytics/reporting (Phase 3)
- Buffer, Facebook/Instagram, YouTube, GBP integrations (Phase 4)
- Off-page/outreach/digital PR (Phase 5)
- Paid campaign preparation (Phase 6)
- Client AI Assistant, conversion tracking, cost dashboard, backup/rollback, API health center, emergency freeze, offboarding, sandbox (Phase 7)
- Email receipts (spec §20) — audit log is the record of truth for now
- Client-side resubmission flow after a "more documents required" / rejected verification (currently: status + reviewer note is visible on `/pending`, but re-uploading requires a new registration or a manual DB fix — a Phase 2 refinement)

### 🔴 Blocked

- None currently.

### ⚠️ Needs external setup / verification (owner action required, cannot be done from this environment)

- Create the actual Supabase project and run the 4 migrations (`supabase/README.md`)
- Create the first Super Admin user and enroll their MFA
- Register two test clients and confirm neither can see the other's data (RLS isolation check)
- Final legal review of the 10 policy texts (currently DRAFT placeholder copy, clearly labeled as such in the seed SQL)
- Decide on a real KYC/Aadhaar verification provider (open item — currently: human review of uploaded documents only)
- Decide on a transactional email provider for the receipts feature (deferred to a later phase)
