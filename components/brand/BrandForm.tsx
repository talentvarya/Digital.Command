"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { updateBrandProfileAction } from "@/app/app/brand/actions";
import type { BrandProfile } from "@/types/database";

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  textarea = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          rows={3}
          className="field-input"
        />
      ) : (
        <input
          id={name}
          name={name}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          className="field-input"
        />
      )}
    </div>
  );
}

export function BrandForm({ brand, logoUrl }: { brand: BrandProfile | null; logoUrl: string | null }) {
  return (
    <ActionForm action={updateBrandProfileAction} className="space-y-6">
      {(state) => (
        <>
          <FormError message={state.error} />

          <section className="card space-y-4">
            <h2 className="text-lg font-semibold text-ink-900">Logo & Visual Identity</h2>
            <div className="flex items-center gap-4">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Current logo" className="h-16 w-16 rounded-lg border border-ink-100 object-contain" />
              )}
              <div className="flex-1">
                <label className="field-label" htmlFor="logo">
                  {logoUrl ? "Replace logo" : "Upload logo"}
                </label>
                <input className="field-input" id="logo" name="logo" type="file" accept="image/*" />
              </div>
            </div>
            <Field label="Brand colors (comma-separated)" name="colors" defaultValue={brand?.colors?.join(", ")} placeholder="#1E40AF, #F59E0B" />
            <Field label="Fonts (comma-separated)" name="fonts" defaultValue={brand?.fonts?.join(", ")} placeholder="Inter, Poppins" />
            <Field label="Image style" name="image_style" defaultValue={brand?.image_style} placeholder="Bright, clean, minimal product shots" />
            <Field label="Video style" name="video_style" defaultValue={brand?.video_style} placeholder="Short, energetic, subtitles on" />
          </section>

          <section className="card space-y-4">
            <h2 className="text-lg font-semibold text-ink-900">Business</h2>
            <Field label="Business description" name="business_description" defaultValue={brand?.business_description} textarea />
            <Field label="Products / services" name="products_services" defaultValue={brand?.products_services} textarea />
            <Field label="Target audience" name="target_audience" defaultValue={brand?.target_audience} textarea />
            <Field label="Location(s)" name="locations" defaultValue={brand?.locations} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" name="phone" defaultValue={brand?.phone} />
              <Field label="WhatsApp" name="whatsapp" defaultValue={brand?.whatsapp} />
            </div>
            <Field label="Current offers" name="offers" defaultValue={brand?.offers} textarea />
            <Field label="Competitors (comma-separated)" name="competitors" defaultValue={brand?.competitors?.join(", ")} />
          </section>

          <section className="card space-y-4">
            <h2 className="text-lg font-semibold text-ink-900">Voice & Guardrails</h2>
            <p className="text-sm text-ink-500">Every AI-generated caption is written using this context.</p>
            <Field label="Preferred tone" name="preferred_tone" defaultValue={brand?.preferred_tone} placeholder="Warm, confident, no jargon" />
            <Field label="Call-to-action style" name="cta_style" defaultValue={brand?.cta_style} placeholder={'"DM us to book" rather than "Buy now"'} />
            <Field label="Words to avoid (comma-separated)" name="words_to_avoid" defaultValue={brand?.words_to_avoid?.join(", ")} placeholder="cheap, guaranteed, best in India" />
            <Field label="Reference content (links or notes)" name="reference_content" defaultValue={brand?.reference_content} textarea />
            <Field label="Approved examples (links or notes)" name="approved_examples" defaultValue={brand?.approved_examples} textarea />
          </section>

          <SubmitButton className="btn-primary w-full" pendingLabel="Saving…">
            Save Brand Brain
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
