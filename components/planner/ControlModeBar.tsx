"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { setControlModeAction } from "@/app/app/planner/actions";
import type { ContentControlMode } from "@/types/database";

export function ControlModeBar({
  mode,
  approvalThenAutopilot,
}: {
  mode: ContentControlMode;
  approvalThenAutopilot: boolean;
}) {
  const [selected, setSelected] = useState<ContentControlMode>(mode);
  const [thenAutopilot, setThenAutopilot] = useState(approvalThenAutopilot);

  return (
    <ActionForm action={setControlModeAction} className="card flex flex-wrap items-center gap-4">
      {(state) => (
        <>
          <input type="hidden" name="mode" value={selected} />
          <input type="hidden" name="approvalThenAutopilot" value={String(thenAutopilot)} />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink-700">Control mode:</span>
            <div className="flex overflow-hidden rounded-lg border border-ink-200">
              {(["approval_required", "autopilot"] as ContentControlMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelected(m)}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    selected === m ? "bg-brand-600 text-white" : "bg-white text-ink-600 hover:bg-ink-50"
                  }`}
                >
                  {m === "autopilot" ? "Autopilot" : "Approval Required"}
                </button>
              ))}
            </div>
          </div>

          {selected === "approval_required" && (
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={thenAutopilot}
                onChange={(e) => setThenAutopilot(e.target.checked)}
              />
              Switch to Autopilot automatically after 7 days
            </label>
          )}

          <SubmitButton className="btn-primary px-3 py-1.5 text-sm">Save</SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
