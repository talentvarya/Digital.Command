"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { addLinkAction } from "@/app/app/links/actions";
import { LINK_TYPE_LABELS } from "@/lib/constants/content";

export function AddLinkForm() {
  return (
    <ActionForm action={addLinkAction} className="card space-y-3">
      {(state) => (
        <>
          <h2 className="text-lg font-semibold text-ink-900">Add a Link</h2>
          <FormError message={state.error} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="linkType">
                Type
              </label>
              <select id="linkType" name="linkType" className="field-input" required>
                {Object.entries(LINK_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="url">
                URL
              </label>
              <input className="field-input" id="url" name="url" placeholder="https://…" required />
            </div>
            <div>
              <label className="field-label" htmlFor="label">
                Label (optional)
              </label>
              <input className="field-input" id="label" name="label" />
            </div>
          </div>
          <SubmitButton className="btn-primary">Add Link</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
