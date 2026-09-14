"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { reviewPaymentAction } from "@/app/admin/clients/[orgId]/actions";

export function PaymentReviewForm({ paymentId, orgId }: { paymentId: string; orgId: string }) {
  const [reason, setReason] = useState("");
  return (
    <ActionForm action={reviewPaymentAction} className="space-y-3">
      {(state) => (
        <>
          <FormError message={state.error} />
          <input type="hidden" name="paymentId" value={paymentId} />
          <input type="hidden" name="orgId" value={orgId} />
          <textarea
            className="field-input"
            name="reason"
            placeholder="Reason (required to reject)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="decision" value="verified" className="btn-primary">
              Verify Payment
            </button>
            <button type="submit" name="decision" value="rejected" className="btn-danger">
              Reject Payment
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
