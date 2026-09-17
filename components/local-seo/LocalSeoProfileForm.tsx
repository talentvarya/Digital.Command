"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { saveLocalSeoProfileAction } from "@/app/app/local-seo/actions";
import type { LocalSeoProfile } from "@/types/database";

export function LocalSeoProfileForm({ profile }: { profile: LocalSeoProfile | null }) {
  return (
    <ActionForm action={saveLocalSeoProfileAction} className="card space-y-3">
      {(state) => (
        <>
          <h2 className="text-lg font-semibold text-ink-900">Your business location (NAP)</h2>
          <p className="text-sm text-ink-500">
            Keep this exactly matching what&apos;s on your Google Business Profile — inconsistent name/address/phone
            across directories is one of the most common local SEO problems.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label">Address</label>
              <input className="field-input" name="address" defaultValue={profile?.address ?? ""} placeholder="Shop 4, MG Road" />
            </div>
            <div>
              <label className="field-label">City</label>
              <input className="field-input" name="city" defaultValue={profile?.city ?? ""} placeholder="Pune" />
            </div>
            <div>
              <label className="field-label">State</label>
              <input className="field-input" name="state" defaultValue={profile?.state ?? ""} placeholder="Maharashtra" />
            </div>
            <div>
              <label className="field-label">Pincode</label>
              <input className="field-input" name="pincode" defaultValue={profile?.pincode ?? ""} placeholder="411001" />
            </div>
            <div>
              <label className="field-label">GBP category</label>
              <input className="field-input" name="gbpCategory" defaultValue={profile?.gbp_category ?? ""} placeholder="Chocolate Shop" />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Google Business Profile link</label>
              <input className="field-input" name="gbpUrl" defaultValue={profile?.gbp_url ?? ""} placeholder="https://g.page/…" />
            </div>
          </div>
          <SubmitButton className="btn-secondary px-4 py-2 text-sm">Save</SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
