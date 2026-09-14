"use client";

import { useState } from "react";
import { Download, UserX } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { offboardOrgAction } from "@/app/admin/clients/[orgId]/actions";
import type { OrganizationStatus } from "@/types/database";

export function OffboardingPanel({ orgId, status, alreadySentCount }: { orgId: string; status: OrganizationStatus; alreadySentCount: number }) {
  const [confirming, setConfirming] = useState(false);

  if (status === "offboarded") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-600">This client has been offboarded — Google connections revoked, Buffer links removed, no data deleted.</p>
        {alreadySentCount > 0 && (
          <p className="text-xs text-amber-600">
            {alreadySentCount} item{alreadySentCount === 1 ? " was" : "s were"} already sent to Buffer/YouTube before offboarding — cancel those
            directly on the platform if needed.
          </p>
        )}
        <a href={`/admin/clients/${orgId}/export`} className="btn-secondary inline-flex items-center px-3 py-2 text-sm">
          <Download className="mr-1 h-4 w-4" /> Export Data
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <a href={`/admin/clients/${orgId}/export`} className="btn-secondary inline-flex items-center px-3 py-2 text-sm">
        <Download className="mr-1 h-4 w-4" /> Export Data
      </a>

      {!confirming ? (
        <button className="btn-danger block px-3 py-2 text-sm" onClick={() => setConfirming(true)}>
          <UserX className="mr-1 inline h-4 w-4" /> Offboard This Client
        </button>
      ) : (
        <ActionForm action={offboardOrgAction} className="rounded-lg border border-red-200 bg-red-50 p-3">
          {(state) => (
            <>
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="confirm" value="true" />
              <p className="text-sm text-red-800">
                This revokes their Google connections, removes Buffer channel links, cancels not-yet-sent scheduled
                content, and marks the account closed. No data is deleted — export it first if you haven&apos;t.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <SubmitButton className="btn-danger px-3 py-2 text-sm" pendingLabel="Offboarding…">
                  Confirm Offboard
                </SubmitButton>
                <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}
