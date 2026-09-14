"use client";

import { useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { updateManualCostsAction } from "@/app/admin/costs/actions";
import { formatInr } from "@/lib/constants/plans";
import { usdToInr } from "@/lib/constants/currency";

export function CostRow({
  orgId,
  legalName,
  revenueInr,
  aiCostUsd,
  manualBufferCostUsd,
  manualStorageCostUsd,
  manualOtherCostUsd,
  manualOtherCostLabel,
}: {
  orgId: string;
  legalName: string;
  revenueInr: number;
  aiCostUsd: number;
  manualBufferCostUsd: number | null;
  manualStorageCostUsd: number | null;
  manualOtherCostUsd: number | null;
  manualOtherCostLabel: string | null;
}) {
  const [editing, setEditing] = useState(false);

  const totalCostUsd = aiCostUsd + (manualBufferCostUsd ?? 0) + (manualStorageCostUsd ?? 0) + (manualOtherCostUsd ?? 0);
  const marginInr = revenueInr - usdToInr(totalCostUsd);
  const lossMaking = marginInr <= 0;

  return (
    <div className={`card ${lossMaking ? "border-red-300 bg-red-50" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-900">{legalName}</span>
          {lossMaking && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" /> At or below breakeven
            </span>
          )}
        </div>
        <button className="text-xs text-brand-600 underline" onClick={() => setEditing((v) => !v)}>
          <Pencil className="mr-1 inline h-3 w-3" /> {editing ? "Close" : "Edit costs"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <div>
          <div className="text-xs uppercase text-ink-400">Revenue (monthly)</div>
          <div className="font-medium text-ink-900">{formatInr(revenueInr)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-ink-400">AI cost</div>
          <div className="text-ink-800">${aiCostUsd.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-ink-400">Buffer</div>
          <div className="text-ink-800">{manualBufferCostUsd !== null ? `$${manualBufferCostUsd.toFixed(2)}` : "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-ink-400">Storage / Other</div>
          <div className="text-ink-800">
            {manualStorageCostUsd !== null ? `$${manualStorageCostUsd.toFixed(2)}` : "—"} /{" "}
            {manualOtherCostUsd !== null ? `$${manualOtherCostUsd.toFixed(2)}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-ink-400">Gross margin</div>
          <div className={`font-semibold ${lossMaking ? "text-red-700" : "text-emerald-700"}`}>{formatInr(marginInr)}</div>
        </div>
      </div>

      {editing && (
        <ActionForm action={updateManualCostsAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-ink-50 p-3">
          {(state) => (
            <>
              <input type="hidden" name="orgId" value={orgId} />
              <div>
                <label className="field-label">Buffer cost ($/mo)</label>
                <input className="field-input" type="number" min="0" step="0.01" name="bufferCost" defaultValue={manualBufferCostUsd ?? ""} />
              </div>
              <div>
                <label className="field-label">Storage cost ($/mo)</label>
                <input className="field-input" type="number" min="0" step="0.01" name="storageCost" defaultValue={manualStorageCostUsd ?? ""} />
              </div>
              <div>
                <label className="field-label">Other cost ($/mo)</label>
                <input className="field-input" type="number" min="0" step="0.01" name="otherCost" defaultValue={manualOtherCostUsd ?? ""} />
              </div>
              <div>
                <label className="field-label">Other cost label</label>
                <input className="field-input" name="otherLabel" defaultValue={manualOtherCostLabel ?? ""} placeholder="e.g. domain renewal" />
              </div>
              <SubmitButton className="btn-primary px-3 py-2 text-sm" pendingLabel="Saving…">
                Save
              </SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}
