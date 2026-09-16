"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { setControlModeAction, runAutopilotFillAction } from "@/app/app/planner/actions";
import { PLATFORM_LABELS } from "@/lib/constants/content";
import type { ContentControlMode, ContentPlatform } from "@/types/database";

const ALL_PLATFORMS = Object.keys(PLATFORM_LABELS) as ContentPlatform[];

export function ControlModeBar({
  mode,
  approvalThenAutopilot,
  autopilotPlatforms,
  windowDays,
}: {
  mode: ContentControlMode;
  approvalThenAutopilot: boolean;
  autopilotPlatforms: ContentPlatform[];
  windowDays: number;
}) {
  const [selected, setSelected] = useState<ContentControlMode>(mode);
  const [thenAutopilot, setThenAutopilot] = useState(approvalThenAutopilot);
  const [platforms, setPlatforms] = useState<Set<ContentPlatform>>(new Set(autopilotPlatforms));

  function togglePlatform(platform: ContentPlatform) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <ActionForm action={setControlModeAction} className="card flex flex-wrap items-center gap-4">
        {(state) => (
          <>
            <input type="hidden" name="mode" value={selected} />
            <input type="hidden" name="approvalThenAutopilot" value={String(thenAutopilot)} />
            {[...platforms].map((p) => (
              <input key={p} type="hidden" name="autopilotPlatforms" value={p} />
            ))}
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

            {selected === "autopilot" && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink-600">Generate for:</span>
                {ALL_PLATFORMS.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm text-ink-600">
                    <input type="checkbox" checked={platforms.has(p)} onChange={() => togglePlatform(p)} />
                    {PLATFORM_LABELS[p]}
                  </label>
                ))}
              </div>
            )}

            <SubmitButton className="btn-primary px-3 py-1.5 text-sm">Save</SubmitButton>
            <FormError message={state.error} />
          </>
        )}
      </ActionForm>

      {mode === "autopilot" && autopilotPlatforms.length > 0 && (
        <ActionForm action={runAutopilotFillAction} className="card flex flex-wrap items-center gap-3">
          {(state) => (
            <>
              <input type="hidden" name="windowDays" value={windowDays} />
              <p className="text-sm text-ink-600">
                Autopilot is set to generate for{" "}
                <span className="font-medium text-ink-800">
                  {autopilotPlatforms.map((p) => PLATFORM_LABELS[p]).join(", ")}
                </span>
                . Fill any empty slots in this {windowDays}-day window right now instead of waiting to click each
                one:
              </p>
              <SubmitButton className="btn-secondary px-3 py-1.5 text-sm" pendingLabel="Filling…">
                Fill this window now
              </SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}
