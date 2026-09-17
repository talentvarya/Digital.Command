"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { clearPlannerAction } from "@/app/app/planner/actions";

export function ClearPlannerButton({ startDate, endDate, windowLabel }: { startDate: string; endDate: string; windowLabel: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-sm text-red-600 hover:underline"
      >
        <Trash2 className="h-3.5 w-3.5" /> Clear all posts
      </button>
    );
  }

  return (
    <ActionForm action={clearPlannerAction} className="card space-y-2 border-red-200 bg-red-50">
      {(state) => (
        <>
          <input type="hidden" name="startDate" value={startDate} />
          <input type="hidden" name="endDate" value={endDate} />
          <p className="text-sm text-red-800">
            This deletes every draft, waiting-approval, and scheduled-but-not-yet-sent post in the current{" "}
            {windowLabel} view. Posts already published, and any locked item, are left alone. This can&apos;t be
            undone.
          </p>
          <div className="flex items-center gap-2">
            <SubmitButton className="btn-primary bg-red-600 px-3 py-1.5 text-sm hover:bg-red-700" pendingLabel="Clearing…">
              Yes, clear all posts
            </SubmitButton>
            <button type="button" onClick={() => setConfirming(false)} className="btn-secondary px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
