"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { generateReportAction } from "@/app/app/reports/actions";
import { REPORT_PERIOD_DAYS, REPORT_PERIOD_LABELS } from "@/lib/constants/google";

export function GenerateReportForm() {
  return (
    <ActionForm action={generateReportAction} className="card flex flex-wrap items-end gap-3">
      {(state) => (
        <>
          <div>
            <label className="field-label" htmlFor="periodDays">
              Report period
            </label>
            <select id="periodDays" name="periodDays" className="field-input" defaultValue="14">
              {REPORT_PERIOD_DAYS.map((days) => (
                <option key={days} value={days}>
                  {REPORT_PERIOD_LABELS[days]}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Generating…">
            Generate Report
          </SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
