"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { logConversionEventAction } from "@/app/app/conversions/actions";
import type { ConversionLink } from "@/types/database";

export function LogConversionForm({ links }: { links: ConversionLink[] }) {
  return (
    <ActionForm action={logConversionEventAction} className="card space-y-2">
      {(state) => (
        <>
          <h3 className="font-medium text-ink-900">Log a conversion</h3>
          <p className="text-xs text-ink-500">For anything that didn&apos;t come through a tracked link — a sale closed over the phone, say.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="field-label">Type</label>
              <select name="eventType" className="field-input" defaultValue="lead">
                <option value="lead">Lead</option>
                <option value="sale">Sale</option>
                <option value="booking">Booking</option>
              </select>
            </div>
            <div>
              <label className="field-label">Value (₹, optional)</label>
              <input className="field-input" type="number" min="0" step="0.01" name="value" />
            </div>
            {links.length > 0 && (
              <div>
                <label className="field-label">From link (optional)</label>
                <select name="linkId" className="field-input" defaultValue="">
                  <option value="">Not from a tracked link</option>
                  {links.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex-1">
              <label className="field-label">Notes (optional)</label>
              <input className="field-input" name="notes" />
            </div>
            <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Logging…">
              Log It
            </SubmitButton>
          </div>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
