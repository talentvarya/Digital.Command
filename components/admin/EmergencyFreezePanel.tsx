"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { setEmergencyFreezeAction } from "@/app/admin/dashboard/actions";

export function EmergencyFreezePanel({
  frozen,
  frozenReason,
  frozenAt,
}: {
  frozen: boolean;
  frozenReason: string | null;
  frozenAt: string | null;
}) {
  const [confirming, setConfirming] = useState(false);

  if (frozen) {
    return (
      <div className="card border-red-200 bg-red-50">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <h2 className="font-semibold text-red-900">Emergency Freeze is active</h2>
            <p className="mt-1 text-sm text-red-800">
              Publishing, uploads, outreach, and AI jobs are paused platform-wide. Login, reports, and audit logs
              stay available.
            </p>
            {frozenReason && <p className="mt-1 text-sm text-red-700">Reason: {frozenReason}</p>}
            {frozenAt && <p className="text-xs text-red-500">Since {new Date(frozenAt).toLocaleString()}</p>}
          </div>
        </div>
        <ActionForm action={setEmergencyFreezeAction} className="mt-3">
          {(state) => (
            <>
              <input type="hidden" name="freeze" value="false" />
              <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Lifting…">
                Lift Freeze
              </SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button className="btn-danger px-4 py-2 text-sm" onClick={() => setConfirming(true)}>
        <ShieldAlert className="mr-1 inline h-4 w-4" /> Emergency Freeze
      </button>
    );
  }

  return (
    <ActionForm action={setEmergencyFreezeAction} className="card border-red-200 bg-red-50">
      {(state) => (
        <>
          <input type="hidden" name="freeze" value="true" />
          <h2 className="font-semibold text-red-900">Confirm Emergency Freeze</h2>
          <p className="mt-1 text-sm text-red-800">
            This immediately stops publishing, uploads, outreach, and AI jobs for every client on the platform.
            Login, reports, and audit logs stay available for investigation. Data is never deleted.
          </p>
          <label className="field-label mt-2">Reason (required)</label>
          <textarea className="field-input" name="reason" rows={2} required />
          <div className="mt-2 flex items-center gap-2">
            <SubmitButton className="btn-danger px-4 py-2" pendingLabel="Freezing…">
              Confirm Freeze
            </SubmitButton>
            <button type="button" className="btn-secondary px-4 py-2" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
