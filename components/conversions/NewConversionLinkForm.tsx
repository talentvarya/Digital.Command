"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { createConversionLinkAction } from "@/app/app/conversions/actions";
import { CONVERSION_LINK_TYPE_LABELS } from "@/lib/constants/conversions";
import type { ConversionLinkType } from "@/types/database";

export function NewConversionLinkForm() {
  return (
    <ActionForm action={createConversionLinkAction} className="card flex flex-wrap items-end gap-2">
      {(state) => (
        <>
          <div>
            <label className="field-label">Type</label>
            <select name="type" className="field-input" defaultValue="whatsapp">
              {(Object.keys(CONVERSION_LINK_TYPE_LABELS) as ConversionLinkType[]).map((t) => (
                <option key={t} value={t}>
                  {CONVERSION_LINK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="field-label">Label</label>
            <input className="field-input" name="label" placeholder="e.g. Homepage WhatsApp button" required />
          </div>
          <div className="flex-1">
            <label className="field-label">Sends people to</label>
            <input className="field-input" name="destination" placeholder="https://wa.me/91XXXXXXXXXX or tel:+91XXXXXXXXXX" required />
          </div>
          <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Adding…">
            Add Link
          </SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
