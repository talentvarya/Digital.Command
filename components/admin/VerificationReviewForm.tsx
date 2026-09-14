"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { reviewVerificationAction } from "@/app/admin/clients/[orgId]/actions";

export function VerificationReviewForm({ verificationId, orgId }: { verificationId: string; orgId: string }) {
  const [reason, setReason] = useState("");
  return (
    <ActionForm action={reviewVerificationAction} className="space-y-3">
      {(state) => (
        <>
          <FormError message={state.error} />
          <input type="hidden" name="verificationId" value={verificationId} />
          <input type="hidden" name="orgId" value={orgId} />
          <textarea
            className="field-input"
            name="reason"
            placeholder="Reason (required for Reject / Request More Documents)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="decision" value="approved" className="btn-primary">
              Approve
            </button>
            <button type="submit" name="decision" value="more_documents_required" className="btn-secondary">
              Request More Documents
            </button>
            <button type="submit" name="decision" value="rejected" className="btn-danger">
              Reject
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
