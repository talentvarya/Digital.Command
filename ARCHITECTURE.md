# Digital Command — Architecture (Phase 1 + 2)

## Stack

- **Next.js 14 (App Router) + TypeScript** — server components for data fetching, server actions for all mutations.
- **Supabase**: Postgres + Auth + Storage, accessed via `@supabase/ssr`. RLS is the authorization layer — the app almost never needs the service-role key (see `SECURITY_AND_RLS.md`).
- **TailwindCSS** for styling, `lucide-react` for icons, `zod` for input validation at the server-action boundary.
- **`@anthropic-ai/sdk`** (Phase 2) — server-only, generates 7-Day Planner captions (`claude-haiku-4-5-20251001`). See "AI content generation" below.

## Route map

```
/                          Public marketing/landing page
/login /forgot-password /reset-password
/register                  Step 1: account creation (email/password)
/register/check-email      Shown if Supabase requires email confirmation
/register/details          Step 2: business type, package, documents, payment, consent
/pending                   Client-facing status tracker (pre-activation)
/admin/mfa-setup           Forced TOTP enrollment for Super Admin
/admin/dashboard           Stat cards + client table
/admin/clients/[orgId]     Verification/payment review, activation, audit trail
/app/dashboard             Post-activation client dashboard
/app/brand                 Brand Brain form (spec §18) — feeds every AI generation prompt
/app/links                 Website & channel link registry + reachability health check (spec §12)
/app/planner               7-Day Content Planner — AI generation, approval workflow, manual uploads (spec §10/§11)
/api/auth/callback         Exchanges Supabase Auth email-link codes for a session
```

`middleware.ts` (via `lib/supabase/middleware.ts`) refreshes the Supabase session on every request and enforces route guards: auth required for `/admin`, `/app`, `/pending`, `/register/details`; role check + MFA check for `/admin/*`; org-membership + `status === 'active'` check for `/app/*` (which is why `/app/brand`, `/app/links`, `/app/planner` are unreachable until Super Admin activation — same guard, no extra wiring needed).

## Data flow for the registration → activation lifecycle

```
/register (signUpAction)
  -> supabase.auth.signUp()
  -> if session returned: /register/details
     else (email confirmation required): /register/check-email -> /login -> getPostLoginRedirect -> /register/details

/register/details (completeRegistrationAction, one server action, one request)
  -> insert organizations (status=draft)
  -> insert organization_members (owner)
  -> insert subscriptions (status=pending)
  -> insert business_verifications (status=draft) + upload docs to Storage + verification_documents rows
  -> update business_verifications.status = submitted
  -> update organizations.status = pending_approval
  -> insert payments (status=pending_verification) [+ screenshot upload]
  -> insert consent_records (one per required policy_versions row)
  -> logAudit('registration_submitted')
  -> redirect /pending

Super Admin (/admin/clients/[orgId] actions)
  -> reviewVerificationAction: business_verifications.status = approved | rejected | more_documents_required
  -> reviewPaymentAction: payments.status = verified | rejected
  -> activateOrgAction (only enabled when verification=approved AND payment=verified): organizations.status = active
       -> DB trigger handle_org_activation(): creates client_settings, activates + dates the subscription
  -> rejectApplicationAction: organizations.status = rejected (terminal)
  -> every action calls logAudit(...)
```

All of the above run under the **calling user's own authenticated session** — RLS policies (not application code) are what actually prevent a client from, say, approving their own verification. See `SECURITY_AND_RLS.md`.

## AI content generation (Phase 2, `lib/ai/generate-content.ts`)

```
generateAiContentAction (app/app/planner/actions.ts)
  -> fetch brand_profiles + client_settings.content_control_mode for the org
  -> generateCaption({ platform, brandProfile, previousCaptions, clientSuggestion })
       -> @anthropic-ai/sdk, model claude-haiku-4-5-20251001, system prompt built from
          Brand Brain fields, strict-JSON response parsed with a plain-text fallback
  -> findAvoidedWords(caption, brand.words_to_avoid) — the real "Quality/Policy check" (spec §10)
  -> status = autopilot && no avoided words  ? 'scheduled'
            : 'waiting_approval'                (approval_required, OR autopilot held for policy)
  -> insert/update content_items + append a content_versions row
  -> if held-for-policy under Autopilot: insert a notification explaining why
```

Regeneration ("Generate Another") reuses the same action with an existing `contentItemId`, incrementing `content_items.rejection_count` each time. Once that count reaches `REJECTIONS_BEFORE_SUGGESTION` (3, `lib/constants/content.ts`), the action refuses to regenerate without a `clientSuggestion` — implementing spec §10's "3 rejected options → ask for suggestion → generate from suggestion → Approve or Skip" flow. The UI (`ContentItemCard`) hides further regeneration once a suggestion-based round has been used.

Client-uploaded content (`createManualContentAction`) skips this pipeline entirely — source `client_uploaded`, status goes straight to `scheduled`, since it's the client's own work being reviewed by no one but themselves (spec §11: adding your own content to a slot means Autopilot shouldn't also generate for it — trivially true here since the slot's only item is created immediately).

## Modularity seam for future integrations (spec §13/§39)

Nothing in Phase 1 talks to Buffer, Google, Meta, or YouTube yet, but the schema and route structure already assume a **publishing-adapter** shape for Phase 4+:

```
Digital Command (planner, approvals, audit, Brand Brain)
        -> Social Publishing Adapter (interface, not yet implemented)
                -> Buffer   OR   Direct Platform APIs
```

`api_connections` / `api_health_events` tables (spec §25) are intentionally **not created yet** — they'll be added in the phase that actually needs them, so Phase 1's schema stays honest about what's real.

## Directory structure

```
app/                    Route segments (pages + colocated server actions)
components/             Shared UI; admin/, client/, registration/, brand/, links/, planner/ subfolders
lib/
  supabase/             Browser/server/middleware Supabase clients + storage upload helper
  audit/                logAudit() helper used by every mutating action
  auth/                 getPostLoginRedirect(), requireSuperAdmin(), requireOrgMember()
  ai/                   generateCaption() / findAvoidedWords() — Anthropic API wrapper (Phase 2)
  constants/            Business-type doc requirements, plan pricing, required policy list,
                        platform/link-type labels, revision-flow threshold (Phase 2 additions)
  validation/           zod schemas for registration input
  utils/                Request IP/user-agent extraction for audit logs
types/database.ts       Hand-written types mirroring the SQL schema (no live project yet to codegen from)
supabase/migrations/    SQL migrations, run in order (see supabase/README.md)
```
