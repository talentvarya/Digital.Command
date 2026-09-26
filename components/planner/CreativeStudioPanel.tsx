"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { createCreativeAction } from "@/app/app/planner/creative-actions";
import { CREATIVE_SIZES, CREATIVE_STYLES, CREATIVE_STYLE_LABELS } from "@/lib/creative/spec";

// Per-post "Create image" panel: pick a look, or leave everything on Auto.
export function CreativeStudioPanel({
  itemId,
  aiAvailable,
  hasGraphic,
}: {
  itemId: string;
  aiAvailable: boolean;
  hasGraphic: boolean;
}) {
  return (
    <ActionForm action={createCreativeAction} className="mt-3 space-y-3 rounded-lg bg-ink-50 p-3">
      {(state) => (
        <>
          <input type="hidden" name="contentItemId" value={itemId} />
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor={`creative-style-${itemId}`}>
                Style
              </label>
              <select id={`creative-style-${itemId}`} name="style" className="field-input" defaultValue="auto">
                <option value="auto">Auto (from the caption)</option>
                {CREATIVE_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {CREATIVE_STYLE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor={`creative-bg-${itemId}`}>
                Background
              </label>
              <select id={`creative-bg-${itemId}`} name="background" className="field-input" defaultValue="auto">
                <option value="auto">Auto (best available)</option>
                <option value="colors">Brand colours</option>
                <option value="stock">Stock photo</option>
                <option value="ai" disabled={!aiAvailable}>
                  {aiAvailable ? "AI photo (free)" : "AI photo — not switched on yet"}
                </option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor={`creative-size-${itemId}`}>
                Size
              </label>
              <select id={`creative-size-${itemId}`} name="size" className="field-input" defaultValue="auto">
                <option value="auto">Auto (recommended)</option>
                <option value="square">{CREATIVE_SIZES.square.label}</option>
                <option value="portrait">{CREATIVE_SIZES.portrait.label}</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-ink-500">
            Uses the words from this post plus your Brand Brain colours and logo. Auto size is tall for Instagram and
            square for Facebook.
            {hasGraphic ? " A new image replaces the one made earlier; pictures you uploaded yourself are kept." : ""}
          </p>
          <FormError message={state.error} />
          <SubmitButton className="btn-primary px-3 py-2 text-sm" pendingLabel="Creating… (up to a minute)">
            {hasGraphic ? "Create a new image" : "Create image"}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
