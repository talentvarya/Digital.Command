# Digital Command — Project Plan

Source of truth: `Digital_Command_Claude_Master_Build_Spec.md` (owner-supplied). This file tracks how that spec maps to build phases; it does not restate the spec.

## Phases (spec §35)

| Phase | Scope | Status |
|---|---|---|
| **1** | Branding shell, Supabase Auth, multi-tenant DB + RLS, Super Admin, client registration, policy acceptance, business verification, manual payment verification, client activation | **This build** |
| 2 | Client dashboard, Brand Brain, website/link setup, 7-day planner, Autopilot/Approval Required, content versions, notifications | Not started |
| 3 | SEO audit, Search Console, Analytics, reporting, graphs, keyword/competitor tracking | Not started |
| 4 | Buffer integration, Facebook/Instagram publishing, YouTube, GBP/Local SEO | Not started |
| 5 | Off-page opportunity engine, outreach, digital PR, backlink verification | Not started |
| 6 | Paid campaign preparation, manual approval, budget/date controls, ad reporting | Not started |
| 7 | Client AI Assistant, conversion tracking, cost dashboard, backup/rollback, API health center, emergency freeze, offboarding, sandbox | Not started |

## Phase 1 exit criteria

- A visitor can register a business, accept every mandatory policy, submit business-verification documents and a manual payment reference.
- A Super Admin can review verification documents, approve/reject/request more documents (reason mandatory for the latter two), verify or reject the payment, and activate the account — all via role-gated pages, no service-role key involved.
- Data is isolated per organization via Postgres RLS — verified by registering two test clients and confirming neither can see the other's rows.
- Every state-changing action is recorded in `audit_logs` with actor, source, before/after state.
- Super Admin login requires TOTP MFA before reaching the dashboard.
- Non-Phase-1 client dashboard modules are visibly labeled "Coming in next build phase" — never presented as working.

## Explicit non-goals for Phase 1

- No Buffer/Google/Meta/YouTube API integrations (Phase 4).
- No real KYC/Aadhaar verification API (open item — spec §37.1/§37.2); documents are reviewed by a human Super Admin.
- No email receipts (spec §20) — audit log is the authoritative record until a later phase wires up an email provider (open item §37.4).
- No paid-advertising anything (Phase 6) — not even a placeholder UI, to avoid any risk of implying auto-spend.
