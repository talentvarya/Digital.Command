"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { completeRegistrationAction } from "@/app/register/actions";
import { BUSINESS_TYPE_LABELS, BUSINESS_TYPE_REQUIREMENTS } from "@/lib/constants/business";
import { PLAN_DISPLAY, BILLING_TERM_LABELS, formatInr } from "@/lib/constants/plans";
import { REQUIRED_POLICY_TYPES } from "@/lib/constants/policies";
import type { BusinessType, PolicyType } from "@/types/database";

interface PolicyRow {
  id: string;
  policy_type: PolicyType;
  title: string;
  body: string;
}

const POLICY_LABELS: Record<PolicyType, string> = {
  terms: "Terms & Conditions",
  privacy: "Privacy Policy",
  package_scope: "Selected Package & Service Scope",
  verification_consent: "Business / Identity Verification Consent",
  marketing_authorization: "Digital Marketing Authorization",
  data_retention: "Data Retention Policy",
  refund_cancellation: "Refund / Cancellation Policy",
  audit_logging_consent: "Audit / Activity Logging Consent",
  third_party_disclosure: "Third-Party Platform Disclosure",
  authorized_representative: "Authorized Business Representative Confirmation",
};

type BillingTermKey = "quarterly" | "half_yearly" | "yearly";
type PlanCodeKey = keyof typeof PLAN_DISPLAY;

const emptyConsents = () =>
  Object.fromEntries(REQUIRED_POLICY_TYPES.map((t) => [t, false])) as Record<PolicyType, boolean>;

export function DetailsForm({ policies }: { policies: PolicyRow[] }) {
  const [businessType, setBusinessType] = useState<BusinessType | "">("");
  const [planCode, setPlanCode] = useState<PlanCodeKey>("package_a");
  const [billingTerm, setBillingTerm] = useState<BillingTermKey>("quarterly");
  const [consents, setConsents] = useState<Record<PolicyType, boolean>>(emptyConsents);
  const [expanded, setExpanded] = useState<PolicyType | null>(null);

  const requirements = businessType ? BUSINESS_TYPE_REQUIREMENTS[businessType] : null;
  const allConsentsChecked = REQUIRED_POLICY_TYPES.every((t) => consents[t]);
  const selectedPlan = PLAN_DISPLAY[planCode];
  const price = selectedPlan.pricing[billingTerm];

  const policyByType = useMemo(() => {
    const map = new Map<PolicyType, PolicyRow>();
    policies.forEach((p) => map.set(p.policy_type, p));
    return map;
  }, [policies]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold text-ink-900">Complete your registration</h1>
      <p className="mb-8 text-sm text-ink-500">
        Step 2 of 2 — this goes to Super Admin for approval once submitted.
      </p>

      <ActionForm action={completeRegistrationAction} className="space-y-8">
        {(state) => (
          <>
            <FormError message={state.error} />

            <section className="card space-y-4">
              <h2 className="text-lg font-semibold text-ink-900">Business Details</h2>
              <div>
                <label className="field-label" htmlFor="businessType">
                  Business Type
                </label>
                <select
                  id="businessType"
                  name="businessType"
                  required
                  className="field-input"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                >
                  <option value="" disabled>
                    Select business type
                  </option>
                  {Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="legalName">
                  Business / Legal Name
                </label>
                <input className="field-input" id="legalName" name="legalName" required />
              </div>

              {requirements?.details.map((field) => (
                <div key={field.key}>
                  <label className="field-label" htmlFor={`detail_${field.key}`}>
                    {field.label}
                    {field.required && " *"}
                  </label>
                  <input
                    className="field-input"
                    id={`detail_${field.key}`}
                    name={`detail_${field.key}`}
                    required={field.required}
                  />
                </div>
              ))}
            </section>

            <section className="card space-y-4">
              <h2 className="text-lg font-semibold text-ink-900">Package & Billing</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="planCode">
                    Package
                  </label>
                  <select
                    id="planCode"
                    name="planCode"
                    className="field-input"
                    value={planCode}
                    onChange={(e) => setPlanCode(e.target.value as PlanCodeKey)}
                  >
                    {Object.entries(PLAN_DISPLAY).map(([code, plan]) => (
                      <option key={code} value={code}>
                        {plan.name} — {plan.tagline}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="billingTerm">
                    Billing Term
                  </label>
                  <select
                    id="billingTerm"
                    name="billingTerm"
                    className="field-input"
                    value={billingTerm}
                    onChange={(e) => setBillingTerm(e.target.value as BillingTermKey)}
                  >
                    {Object.entries(BILLING_TERM_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
                <div className="font-semibold">{formatInr(price)}</div>
                <ul className="mt-1 list-inside list-disc text-brand-700">
                  {selectedPlan.includes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {planCode === "custom" && (
                  <p className="mt-1 text-brand-700">
                    Our team will follow up with custom pricing for more than 2 websites/brands.
                  </p>
                )}
              </div>
            </section>

            {requirements && (
              <section className="card space-y-4">
                <h2 className="text-lg font-semibold text-ink-900">Verification Documents</h2>
                <p className="text-sm text-ink-500">
                  Required for {BUSINESS_TYPE_LABELS[businessType as BusinessType]}. Reviewed by Super Admin before
                  activation.
                </p>
                {requirements.documents.map((doc) => (
                  <div key={doc.key}>
                    <label className="field-label" htmlFor={`doc_${doc.key}`}>
                      {doc.label}
                      {doc.required && " *"}
                    </label>
                    <input
                      className="field-input"
                      id={`doc_${doc.key}`}
                      name={`doc_${doc.key}`}
                      type="file"
                      accept="image/*,application/pdf"
                      required={doc.required}
                    />
                  </div>
                ))}
              </section>
            )}

            <section className="card space-y-4">
              <h2 className="text-lg font-semibold text-ink-900">Payment Submission</h2>
              <p className="text-sm text-ink-500">
                Payment is collected outside the platform. Enter your payment details below for Super Admin
                verification.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="amount">
                    Amount Paid (INR)
                  </label>
                  <input className="field-input" id="amount" name="amount" type="number" step="0.01" min="0" required />
                </div>
                <div>
                  <label className="field-label" htmlFor="paymentDate">
                    Payment Date
                  </label>
                  <input className="field-input" id="paymentDate" name="paymentDate" type="date" required />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="transactionRef">
                  Transaction / UTR Number
                </label>
                <input className="field-input" id="transactionRef" name="transactionRef" required />
              </div>
              <div>
                <label className="field-label" htmlFor="paymentScreenshot">
                  Payment Screenshot (optional)
                </label>
                <input
                  className="field-input"
                  id="paymentScreenshot"
                  name="paymentScreenshot"
                  type="file"
                  accept="image/*"
                />
              </div>
            </section>

            <section className="card space-y-3">
              <h2 className="text-lg font-semibold text-ink-900">Policies & Consent</h2>
              <p className="text-sm text-ink-500">All items below are mandatory. Expand to read the full text.</p>
              {REQUIRED_POLICY_TYPES.map((type) => {
                const policy = policyByType.get(type);
                return (
                  <div key={type} className="rounded-lg border border-ink-100 p-3">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={`consent_${type}`}
                        value="true"
                        checked={consents[type]}
                        onChange={(e) => setConsents((c) => ({ ...c, [type]: e.target.checked }))}
                        className="mt-0.5"
                        required
                      />
                      <span>
                        I have read and accept the{" "}
                        <button
                          type="button"
                          className="font-medium text-brand-600 underline"
                          onClick={() => setExpanded(expanded === type ? null : type)}
                        >
                          {POLICY_LABELS[type]}
                        </button>
                      </span>
                    </label>
                    {expanded === type && (
                      <div className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line rounded bg-ink-50 p-3 text-xs text-ink-600">
                        {policy?.body ?? "Policy text unavailable."}
                      </div>
                    )}
                  </div>
                );
              })}

              <label className="flex items-start gap-2 border-t border-ink-100 pt-3 text-sm text-ink-600">
                <input type="checkbox" name="promoOptIn" value="true" className="mt-0.5" />
                <span>(Optional) I&apos;d like to receive marketing/promotional communication from Digital Command.</span>
              </label>
            </section>

            <div className="space-y-2">
              <SubmitButton
                className="btn-primary w-full"
                pendingLabel="Submitting…"
                disabled={!allConsentsChecked}
              >
                Submit for Super Admin Approval
              </SubmitButton>
              {!allConsentsChecked && (
                <p className="text-center text-xs text-ink-400">
                  Accept all mandatory policies above to enable submission.
                </p>
              )}
            </div>
          </>
        )}
      </ActionForm>
    </main>
  );
}
