"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { createCreativeAction } from "@/app/app/planner/creative-actions";
import { CREATIVE_SIZES, CREATIVE_STYLES, CREATIVE_STYLE_LABELS, deriveCreativeText, pickStyle } from "@/lib/creative/spec";

const MIN_AI_DESCRIPTION = 8;

// Per-post "Create image" panel. The client describes the picture they want (or
// starts from an idea), optionally changes the words on it, and nothing is made
// until they press Create image.
export function CreativeStudioPanel({
  itemId,
  caption,
  imagePrompt,
  aiAvailable,
  hasGraphic,
  productHint,
}: {
  itemId: string;
  caption: string | null;
  imagePrompt: string;
  aiAvailable: boolean;
  hasGraphic: boolean;
  productHint: string;
}) {
  const defaults = useMemo(() => deriveCreativeText(caption, pickStyle(caption), ""), [caption]);
  const [prompt, setPrompt] = useState(imagePrompt);
  const [background, setBackground] = useState("auto");

  const product = productHint || "your product";
  const ideas = [
    { label: "Product close-up", text: `Close-up of ${product} on a clean table, soft natural light` },
    { label: "In use", text: `A happy customer enjoying ${product}, warm and friendly mood` },
    { label: "Festive", text: `${product} arranged with festive decorations and warm lights, celebration mood` },
    { label: "Flat-lay", text: `Flat-lay of ${product} with a few simple props, seen from above, minimal background` },
    { label: "Behind the scenes", text: `Hands carefully preparing ${product}, workshop feel` },
  ];

  const aiNeedsDescription = background === "ai" && prompt.trim().length < MIN_AI_DESCRIPTION;

  return (
    <ActionForm action={createCreativeAction} className="mt-3 space-y-3 rounded-lg bg-ink-50 p-3">
      {(state) => (
        <>
          <input type="hidden" name="contentItemId" value={itemId} />

          <div>
            <label className="field-label" htmlFor={`creative-prompt-${itemId}`}>
              Describe the picture you want
            </label>
            <textarea
              id={`creative-prompt-${itemId}`}
              name="imagePrompt"
              className="field-input"
              rows={3}
              maxLength={500}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: a hand-made chocolate gift box on a wooden table, warm festive light, Diwali mood"
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-400">Ideas:</span>
              {ideas.map((idea) => (
                <button
                  key={idea.label}
                  type="button"
                  className="rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-xs text-ink-600 hover:border-brand-300 hover:text-brand-700"
                  onClick={() => setPrompt(idea.text)}
                >
                  {idea.label}
                </button>
              ))}
            </div>
            <p className={`mt-1.5 text-xs ${aiNeedsDescription ? "text-amber-700" : "text-ink-500"}`}>
              {aiNeedsDescription
                ? "The AI photo is made from this description, so write a few words about what it should show."
                : "Say what it should show, where, and the mood. Nothing is made until you press Create image; your description is saved with the post."}
            </p>
          </div>

          <details className="rounded-lg border border-ink-100 bg-white px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-ink-600">Change the words on the picture</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor={`creative-headline-${itemId}`}>
                  Headline
                </label>
                <input
                  id={`creative-headline-${itemId}`}
                  name="headline"
                  className="field-input"
                  maxLength={100}
                  defaultValue={defaults.headline}
                />
              </div>
              <div>
                <label className="field-label" htmlFor={`creative-subline-${itemId}`}>
                  Second line (optional)
                </label>
                <input
                  id={`creative-subline-${itemId}`}
                  name="subline"
                  className="field-input"
                  maxLength={140}
                  defaultValue={defaults.subline ?? ""}
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-ink-400">Starts from the first sentences of the caption.</p>
          </details>

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
              <select
                id={`creative-bg-${itemId}`}
                name="background"
                className="field-input"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
              >
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
            Uses your Brand Brain colours and logo. Auto size is tall for Instagram and square for Facebook.
            {hasGraphic ? " A new image replaces the one made earlier; pictures you uploaded yourself are kept." : ""}
          </p>
          <FormError message={state.error} />
          <SubmitButton className="btn-primary px-3 py-2 text-sm" pendingLabel="Creating… (up to a minute)" disabled={aiNeedsDescription}>
            {hasGraphic ? "Create a new image" : "Create image"}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
