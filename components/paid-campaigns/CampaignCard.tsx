"use client";

import { useState } from "react";
import { Pencil, Trash2, ShieldCheck } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ApprovalHistory } from "@/components/paid-campaigns/ApprovalHistory";
import {
  updateCampaignAction,
  submitForApprovalAction,
  approveCampaignAction,
  rejectCampaignAction,
  deleteCampaignAction,
} from "@/app/app/paid-campaigns/actions";
import { AD_PLATFORM_LABELS, BUDGET_PERIOD_LABELS, CAMPAIGN_OBJECTIVE_OPTIONS } from "@/lib/constants/paid-campaigns";
import { formatInr } from "@/lib/constants/plans";
import type { AdPlatform, BudgetPeriod, PaidCampaign, PaidCampaignApproval } from "@/types/database";

const EDITABLE_STATUSES = ["draft", "pending_approval", "approved", "rejected"];
const READY_TO_APPROVE = (c: PaidCampaign) => Boolean(c.max_spend && c.budget_period && c.start_date && c.end_date);

export function CampaignCard({ campaign, approvals }: { campaign: PaidCampaign; approvals: PaidCampaignApproval[] }) {
  const [editing, setEditing] = useState(campaign.status === "draft");
  const [showReject, setShowReject] = useState(false);
  const canEdit = EDITABLE_STATUSES.includes(campaign.status);

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-ink-900">{campaign.name}</h3>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="text-xs text-ink-500">
            {AD_PLATFORM_LABELS[campaign.platform]} · {campaign.objective}
          </p>
        </div>
        {canEdit && !editing && (
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 inline h-3 w-3" /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <ActionForm
          action={updateCampaignAction}
          className="space-y-3 rounded-lg bg-ink-50 p-3"
        >
          {(state) => (
            <>
              <input type="hidden" name="id" value={campaign.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Campaign name</label>
                  <input className="field-input" name="name" defaultValue={campaign.name} required />
                </div>
                <div>
                  <label className="field-label">Platform</label>
                  <select className="field-input" name="platform" defaultValue={campaign.platform} required>
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
                <input className="field-input" name="objective" list={`objectives-${campaign.id}`} defaultValue={campaign.objective ?? ""} required />
                <datalist id={`objectives-${campaign.id}`}>
                  {CAMPAIGN_OBJECTIVE_OPTIONS.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="field-label">Audience</label>
                <textarea className="field-input" name="audienceDescription" rows={2} defaultValue={campaign.audience_description ?? ""} />
              </div>
              <div>
                <label className="field-label">Keywords (one per line, if relevant)</label>
                <textarea className="field-input" name="keywords" rows={2} defaultValue={campaign.keywords.join("\n")} />
              </div>
              <div>
                <label className="field-label">Creative brief</label>
                <textarea className="field-input" name="creativeBrief" rows={3} defaultValue={campaign.creative_brief ?? ""} />
              </div>
              {campaign.suggested_budget_notes && (
                <div className="rounded-lg border border-brand-100 bg-brand-50 p-2 text-xs text-brand-800">
                  <strong>AI budget guidance (informational only):</strong> {campaign.suggested_budget_notes}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Maximum spend you authorize (INR)</label>
                  <input className="field-input" type="number" min="0" step="1" name="maxSpend" defaultValue={campaign.max_spend ?? ""} />
                </div>
                <div>
                  <label className="field-label">Budget period</label>
                  <select className="field-input" name="budgetPeriod" defaultValue={campaign.budget_period ?? ""}>
                    <option value="">Choose…</option>
                    {(Object.keys(BUDGET_PERIOD_LABELS) as BudgetPeriod[]).map((b) => (
                      <option key={b} value={b}>
                        {BUDGET_PERIOD_LABELS[b]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Start date</label>
                  <input className="field-input" type="date" name="startDate" defaultValue={campaign.start_date ?? ""} />
                </div>
                <div>
                  <label className="field-label">End date</label>
                  <input className="field-input" type="date" name="endDate" defaultValue={campaign.end_date ?? ""} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Saving…">
                  Save
                </SubmitButton>
                {campaign.status !== "draft" && (
                  <button type="button" className="btn-secondary px-4 py-2" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                )}
              </div>
              {(campaign.status === "approved" || campaign.status === "rejected") && (
                <p className="text-xs text-amber-600">Saving changes will resubmit this campaign for approval.</p>
              )}
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      ) : (
        <div className="space-y-2 text-sm">
          {campaign.audience_description && <p className="text-ink-700">{campaign.audience_description}</p>}
          {campaign.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {campaign.keywords.map((k) => (
                <span key={k} className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600">
                  {k}
                </span>
              ))}
            </div>
          )}
          {campaign.creative_brief && <p className="text-ink-600">{campaign.creative_brief}</p>}
          {campaign.max_spend !== null && (
            <p className="text-xs text-ink-500">
              Authorizes up to <strong>{formatInr(campaign.max_spend)}</strong>{" "}
              {campaign.budget_period ? `(${BUDGET_PERIOD_LABELS[campaign.budget_period]})` : ""} · {campaign.start_date} to {campaign.end_date}
            </p>
          )}
        </div>
      )}

      {!editing && campaign.status === "draft" && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-50 pt-3">
          <ActionForm action={submitForApprovalAction}>
            {(state) => (
              <>
                <input type="hidden" name="id" value={campaign.id} />
                <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Submitting…">
                  Submit for Approval
                </SubmitButton>
                <FormError message={state.error} />
              </>
            )}
          </ActionForm>
          <ActionForm action={deleteCampaignAction}>
            {(state) => (
              <>
                <input type="hidden" name="id" value={campaign.id} />
                <button type="submit" className="btn-danger px-4 py-2">
                  <Trash2 className="mr-1 inline h-3 w-3" /> Delete
                </button>
                <FormError message={state.error} />
              </>
            )}
          </ActionForm>
        </div>
      )}

      {!editing && campaign.status === "pending_approval" && (
        <div className="mt-3 space-y-2 border-t border-ink-50 pt-3">
          {READY_TO_APPROVE(campaign) ? (
            <ActionForm action={approveCampaignAction}>
              {(state) => (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <input type="hidden" name="id" value={campaign.id} />
                  <p className="flex items-start gap-2 text-sm text-emerald-900">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    Approving authorizes up to <strong>&nbsp;{formatInr(campaign.max_spend)}</strong>&nbsp;
                    ({campaign.budget_period ? BUDGET_PERIOD_LABELS[campaign.budget_period] : "—"}), {campaign.start_date} to{" "}
                    {campaign.end_date}. VMG will launch this manually in {AD_PLATFORM_LABELS[campaign.platform]} — Digital
                    Command never spends automatically.
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-sm text-emerald-900">
                    <input type="checkbox" name="confirmAuthorization" value="true" required className="mt-1" />
                    I understand this authorizes real ad spend up to the limit above.
                  </label>
                  <div className="mt-2">
                    <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Approving…">
                      Approve
                    </SubmitButton>
                  </div>
                  <FormError message={state.error} />
                </div>
              )}
            </ActionForm>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Add a maximum spend, budget period, and start/end dates above before this can be approved.
            </p>
          )}

          {!showReject ? (
            <button className="text-xs text-red-600 underline" onClick={() => setShowReject(true)}>
              Reject this campaign instead
            </button>
          ) : (
            <ActionForm action={rejectCampaignAction}>
              {(state) => (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <input type="hidden" name="id" value={campaign.id} />
                  <label className="field-label">Reason for rejecting</label>
                  <textarea className="field-input" name="reason" rows={2} required />
                  <div className="mt-2 flex items-center gap-2">
                    <SubmitButton className="btn-danger px-4 py-2" pendingLabel="Rejecting…">
                      Confirm Reject
                    </SubmitButton>
                    <button type="button" className="btn-secondary px-4 py-2" onClick={() => setShowReject(false)}>
                      Cancel
                    </button>
                  </div>
                  <FormError message={state.error} />
                </div>
              )}
            </ActionForm>
          )}
        </div>
      )}

      {!editing && campaign.status === "approved" && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Approved — ready for manual launch. VMG will confirm here once it&apos;s live in {AD_PLATFORM_LABELS[campaign.platform]}.
        </p>
      )}

      {!editing && campaign.status === "rejected" && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Rejected — edit the campaign above to address the feedback below and it will be resubmitted for approval.
        </p>
      )}

      {["launched_externally", "paused", "completed", "cancelled"].includes(campaign.status) && (
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-50 pt-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase text-ink-400">Platform status</dt>
            <dd className="text-ink-800">{campaign.external_platform_status ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-400">Spend to date</dt>
            <dd className="text-ink-800">{campaign.spend_to_date !== null ? formatInr(campaign.spend_to_date) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-400">Clicks</dt>
            <dd className="text-ink-800">{campaign.clicks ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-400">Conversions</dt>
            <dd className="text-ink-800">{campaign.conversions ?? "—"}</dd>
          </div>
        </dl>
      )}

      <ApprovalHistory approvals={approvals} />
    </div>
  );
}
