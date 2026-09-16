"use client";

import { useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { generateAiContentAction, createManualContentAction } from "@/app/app/planner/actions";
import { PLATFORM_LABELS, TIME_SLOTS } from "@/lib/constants/content";
import type { ContentPlatform } from "@/types/database";

const CUSTOM_TIME = "custom";

// Morning/Evening presets plus a free-form time for anyone who wants an
// exact slot — only one "scheduledTime" field is ever rendered, so the
// submitted value is always unambiguous.
function TimeSlotPicker() {
  const [choice, setChoice] = useState<string>(TIME_SLOTS[0].value);

  return (
    <div>
      <label className="field-label">Time</label>
      <select
        className="field-input"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
      >
        {TIME_SLOTS.map((slot) => (
          <option key={slot.value} value={slot.value}>
            {slot.label}
          </option>
        ))}
        <option value={CUSTOM_TIME}>Custom time…</option>
      </select>
      {choice === CUSTOM_TIME ? (
        <input type="time" name="scheduledTime" className="field-input mt-2" required />
      ) : (
        <input type="hidden" name="scheduledTime" value={choice} />
      )}
    </div>
  );
}

export function NewContentForm({ date }: { date: string }) {
  const [mode, setMode] = useState<"ai" | "manual" | null>(null);

  if (!mode) {
    return (
      <div className="flex gap-2">
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setMode("ai")}>
          <Sparkles className="mr-1 inline h-3 w-3" /> Generate with AI
        </button>
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setMode("manual")}>
          <Upload className="mr-1 inline h-3 w-3" /> Add Your Own
        </button>
      </div>
    );
  }

  if (mode === "ai") {
    return (
      <ActionForm action={generateAiContentAction} className="flex flex-wrap items-end gap-2 rounded-lg bg-ink-50 p-3">
        {(state) => (
          <>
            <input type="hidden" name="scheduledDate" value={date} />
            <div>
              <label className="field-label">Platform</label>
              <select name="platform" className="field-input" required>
                {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <TimeSlotPicker />
            <SubmitButton className="btn-primary px-3 py-2 text-sm" pendingLabel="Generating…">
              Generate
            </SubmitButton>
            <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setMode(null)}>
              Cancel
            </button>
            <FormError message={state.error} />
          </>
        )}
      </ActionForm>
    );
  }

  return (
    <ActionForm action={createManualContentAction} className="space-y-2 rounded-lg bg-ink-50 p-3">
      {(state) => (
        <>
          <input type="hidden" name="scheduledDate" value={date} />
          <FormError message={state.error} />
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="field-label">Platform</label>
              <select name="platform" className="field-input" required>
                {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                  <option key={value} value={value as ContentPlatform}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <TimeSlotPicker />
            <div>
              <label className="field-label">Image / video (optional)</label>
              <input className="field-input" type="file" name="media" accept="image/*,video/*" />
            </div>
          </div>
          <div>
            <label className="field-label">Caption</label>
            <textarea className="field-input" name="caption" rows={3} />
          </div>
          <div>
            <label className="field-label">Hashtags</label>
            <input className="field-input" name="hashtags" placeholder="hashtag1 hashtag2" />
          </div>
          <div className="flex gap-2">
            <SubmitButton className="btn-primary px-3 py-2 text-sm" pendingLabel="Saving…">
              Add to Planner
            </SubmitButton>
            <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
