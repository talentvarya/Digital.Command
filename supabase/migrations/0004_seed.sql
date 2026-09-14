-- Digital Command — seed data: plans + policy text
-- Run after 0003_storage.sql.
-- Policy bodies are DRAFT placeholder legal copy (spec open item §37.9) —
-- replace via an update to policy_versions once counsel has reviewed final wording.

insert into public.plans (code, name, websites_included, smo_packages_included, is_custom, price_quarterly, price_half_yearly, price_yearly)
values
  ('package_a', 'Package A — 1 Website + 1 SMO Package', 1, 1, false, 34999, 64999, 119999),
  ('package_b', 'Package B — 2 Websites + 2 SMO Packages', 2, 2, false, 54999, 99999, 179999),
  ('custom', 'Custom / Enterprise', 0, 0, true, null, null, null)
on conflict (code) do nothing;

insert into public.policy_versions (policy_type, version, title, body) values

('terms', 'v1-draft', 'Terms & Conditions', $$DRAFT — PENDING LEGAL REVIEW.

These Terms & Conditions govern your use of Digital Command, an AI Digital Marketing Autopilot platform operated by Visionary Masters Global Pvt. Ltd. ("VMG", "we", "us"). By registering, you agree that VMG will provide the digital marketing services described in your selected package, that automation runs according to the control mode you choose (Autopilot or Approval Required), that paid advertising will never begin without your separate explicit approval, and that your account is subject to the approval, verification and payment processes described during registration. VMG may suspend or terminate access for policy violations, non-payment, or misuse of connected third-party platforms (Google, Meta, YouTube, Buffer). This is placeholder wording; final terms will be issued after legal review.$$),

('privacy', 'v1-draft', 'Privacy Policy', $$DRAFT — PENDING LEGAL REVIEW.

VMG collects the business, identity-verification, and payment information you submit during registration, plus usage data generated as you use Digital Command, in order to operate your account, verify your business, and deliver the marketing services you have subscribed to. Data is stored using Supabase (PostgreSQL with row-level security) and is isolated per client organization. Identity/verification documents are access-restricted and every access is logged. We do not sell your data. Data may be shared with third-party platforms you explicitly connect (see the Third-Party Platform Disclosure). This is placeholder wording; a final privacy policy will be issued after legal review.$$),

('package_scope', 'v1-draft', 'Selected Package & Service Scope', $$DRAFT — PENDING LEGAL REVIEW.

By checking this box you confirm that the package, billing term, and fair-use limits shown to you on the package selection screen accurately reflect the services you are purchasing, and that any service not explicitly listed for your package (including paid advertising, AI video generation beyond the stated allowance, and modules marked "Coming in next build phase") is out of scope unless separately agreed in writing.$$),

('verification_consent', 'v1-draft', 'Business / Identity Verification Consent', $$DRAFT — PENDING LEGAL REVIEW.

You consent to VMG collecting and reviewing the identity and business-registration documents required for your business type (e.g. PAN, incorporation certificate, partnership deed, GSTIN) solely for the purpose of verifying your business before account activation. Documents are stored in access-restricted storage, and every access to them is recorded in the audit trail. Only Super Admin reviewers may approve or reject your verification.$$),

('marketing_authorization', 'v1-draft', 'Digital Marketing Authorization', $$DRAFT — PENDING LEGAL REVIEW.

You authorize VMG to perform the organic digital marketing activities included in your selected package (SEO, off-page SEO, SMO content for Facebook/Instagram/YouTube, Local SEO/Google Business Profile) on your behalf, using the control mode (Autopilot or Approval Required) you select. This authorization does not extend to paid advertising spend, which always requires your separate, explicit approval before any budget is committed.$$),

('data_retention', 'v1-draft', 'Data Retention Policy', $$DRAFT — PENDING LEGAL REVIEW.

VMG retains your account, content, verification, payment, and audit-log records for the duration of your active subscription and for a reasonable period afterward to meet legal, accounting, and dispute-resolution obligations. Upon offboarding, VMG will export your reports and assets to you and begin the retention/deletion process described in the Offboarding procedure, while retaining audit-required records as permitted by law.$$),

('refund_cancellation', 'v1-draft', 'Refund / Cancellation Policy', $$DRAFT — PENDING LEGAL REVIEW.

Once payment is received and your service is activated, the subscription fee for the current term is generally non-refundable, non-transferable, and not subject to pro-rata refund. Exceptions apply for duplicate payment, erroneous charge, service never activated, material failure to provide the contracted service, or where a refund is required by applicable law. Paid advertising spend, when you approve it, is separate from your subscription and is governed by the relevant ad platform's own billing and refund rules.$$),

('audit_logging_consent', 'v1-draft', 'Audit / Activity Logging Consent', $$DRAFT — PENDING LEGAL REVIEW.

You consent to VMG recording an audit trail of important actions taken on your account — by you, by VMG staff, by automation, or by the AI assistant — including the actor, timestamp, and before/after state of the change, for transparency, dispute protection, and security purposes. You will be able to view your own organization's audit trail from your dashboard.$$),

('third_party_disclosure', 'v1-draft', 'Third-Party Platform Disclosure', $$DRAFT — PENDING LEGAL REVIEW.

Delivering your selected services may involve connecting third-party platforms and providers, which may include Buffer (social scheduling), Google (Search Console, Analytics, Business Profile), Meta (Facebook, Instagram), YouTube, and AI content providers. Digital Command acts as the control layer; publishing/automation to these platforms is subject to each provider's own terms and policies, and VMG will comply with those policies (no fake engagement, no manipulative links, no spam automation).$$),

('authorized_representative', 'v1-draft', 'Authorized Business Representative Confirmation', $$DRAFT — PENDING LEGAL REVIEW.

You confirm that you are an authorized representative of the business you are registering (e.g. the proprietor, an authorized partner/signatory, or an authorized director), with the authority to accept these terms, authorize the described marketing activities, and submit verification and payment information on the business's behalf.$$)

on conflict (policy_type, version) do nothing;
