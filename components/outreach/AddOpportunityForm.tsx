"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { addOpportunityAction } from "@/app/app/outreach/actions";

const TYPE_LABELS: Record<string, string> = {
  guest_contribution: "Guest Contribution",
  broken_link: "Broken-Link Replacement",
  unlinked_mention: "Unlinked Mention",
  other: "Other",
};

export function AddOpportunityForm() {
  return (
    <ActionForm action={addOpportunityAction} className="card flex flex-wrap items-end gap-2">
      {(state) => (
        <>
          <div className="flex-1">
            <label className="field-label">Add an opportunity by URL</label>
            <input className="field-input" name="url" placeholder="https://…" required />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select name="opportunityType" className="field-input" defaultValue="other">
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Assessing…">
            Add & Assess
          </SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
