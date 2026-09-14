"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { prepareCampaignAction } from "@/app/app/paid-campaigns/actions";
import { AD_PLATFORM_LABELS, CAMPAIGN_OBJECTIVE_OPTIONS } from "@/lib/constants/paid-campaigns";
import type { AdPlatform } from "@/types/database";

export function NewCampaignForm() {
  return (
    <ActionForm action={prepareCampaignAction} className="card space-y-3">
      {(state) => (
        <>
          <div>
            <h3 className="font-medium text-ink-900">Draft a new paid campaign</h3>
            <p className="text-xs text-ink-500">
              Claude drafts an audience, keywords and creative direction from what it knows about your business —
              nothing is authorized or spent yet. You set the real budget and dates before approving.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Campaign name</label>
              <input className="field-input" name="name" placeholder="e.g. Spring lead-gen push" required />
            </div>
            <div>
              <label className="field-label">Platform</label>
              <select className="field-input" name="platform" defaultValue="" required>
                <option value="" disabled>
                  Choose a platform…
                </option>
                {(Object.keys(AD_PLATFORM_LABELS) as AdPlatform[]).map((p) => (
                  <option key={p} value={p}>
                    {AD_PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">Objective</label>
            <input className="field-input" name="objective" list="campaign-objectives" placeholder="e.g. Lead generation" required />
            <datalist id="campaign-objectives">
              {CAMPAIGN_OBJECTIVE_OPTIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="field-label">What do you want this campaign to achieve?</label>
            <textarea
              className="field-input"
              name="goalDescription"
              rows={2}
              placeholder="e.g. More calls for our weekend appointment slots in the next month"
            />
          </div>
          <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Drafting…">
            Draft with AI
          </SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
