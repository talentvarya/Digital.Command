"use client";

import { PauseCircle, PlayCircle } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { setMasterStopAction } from "@/app/app/dashboard/actions";

export function MasterStopPanel({ masterStop }: { masterStop: boolean }) {
  if (masterStop) {
    return (
      <div className="card border-amber-200 bg-amber-50">
        <div className="flex items-start gap-2">
          <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <h2 className="font-semibold text-amber-900">Automation is paused (Master STOP)</h2>
            <p className="mt-1 text-sm text-amber-800">
              SEO, social, YouTube, content, and outreach automation are paused. Nothing has been deleted — your
              data and history are exactly as they were.
            </p>
          </div>
        </div>
        <ActionForm action={setMasterStopAction} className="mt-3">
          {(state) => (
            <>
              <input type="hidden" name="masterStop" value="false" />
              <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Resuming…">
                <PlayCircle className="mr-1 inline h-4 w-4" /> Resume Automation
              </SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      </div>
    );
  }

  return (
    <ActionForm action={setMasterStopAction}>
      {(state) => (
        <>
          <input type="hidden" name="masterStop" value="true" />
          <SubmitButton className="btn-secondary px-3 py-2 text-sm text-amber-700" pendingLabel="Pausing…">
            <PauseCircle className="mr-1 inline h-4 w-4" /> Master STOP
          </SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
