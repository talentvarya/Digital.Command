"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { activateOrgAction, rejectApplicationAction } from "@/app/admin/clients/[orgId]/actions";

export function ActivationPanel({
  orgId,
  canActivate,
}: {
  orgId: string;
  canActivate: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-4">
      <ActionForm action={activateOrgAction}>
        {(state) => (
          <>
            <FormError message={state.error} />
            <input type="hidden" name="orgId" value={orgId} />
            <SubmitButton className="btn-primary w-full" disabled={!canActivate}>
              Activate Client Account
            </SubmitButton>
            {!canActivate && (
              <p className="mt-2 text-xs text-ink-400">
                Requires verification approved and payment verified.
              </p>
            )}
          </>
        )}
      </ActionForm>

      <ActionForm action={rejectApplicationAction} className="space-y-2 border-t border-ink-100 pt-4">
        {(state) => (
          <>
            <FormError message={state.error} />
            <input type="hidden" name="orgId" value={orgId} />
            <textarea
              className="field-input"
              name="reason"
              placeholder="Reason (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
            <SubmitButton className="btn-danger w-full">Reject Application</SubmitButton>
          </>
        )}
      </ActionForm>
    </div>
  );
}
