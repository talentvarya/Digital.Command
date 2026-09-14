"use client";

import { Rocket } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ApprovalHistory } from "@/components/paid-campaigns/ApprovalHistory";
import { markCampaignLaunchedAction, updateCampaignPerformanceAction } from "@/app/admin/clients/[orgId]/paid-campaign-actions";
import { AD_PLATFORM_LABELS, ADMIN_SETTABLE_STATUSES, BUDGET_PERIOD_LABELS } from "@/lib/constants/paid-campaigns";
import { formatInr } from "@/lib/constants/plans";
import type { PaidCampaign, PaidCampaignApproval } from "@/types/database";

const LAUNCHED_STATUSES = ["launched_externally", "paused", "completed", "cancelled"];

export function PaidCampaignsPanel({ orgId, campaigns, approvals }: { orgId: string; campaigns: PaidCampaign[]; approvals: PaidCampaignApproval[] }) {
  if (campaigns.length === 0) {
    return <p className="text-sm text-ink-400">No paid campaigns prepared yet.</p>;
  }

  const approvalsByCampaign = new Map<string, PaidCampaignApproval[]>();
  approvals.forEach((a) => {
    const list = approvalsByCampaign.get(a.campaign_id) ?? [];
    list.push(a);
    approvalsByCampaign.set(a.campaign_id, list);
  });

  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="rounded-lg border border-ink-100 p-3">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium text-ink-800">{campaign.name}</span>{" "}
              <span className="text-xs text-ink-400">
                {AD_PLATFORM_LABELS[campaign.platform]} · {campaign.objective}
              </span>
            </div>
            <StatusBadge status={campaign.status} />
          </div>

          {campaign.max_spend !== null && (
            <p className="mb-2 text-xs text-ink-500">
              Client-authorized up to <strong>{formatInr(campaign.max_spend)}</strong>{" "}
              {campaign.budget_period ? `(${BUDGET_PERIOD_LABELS[campaign.budget_period]})` : ""} · {campaign.start_date} to{" "}
              {campaign.end_date}
            </p>
          )}

          {campaign.status === "approved" && (
            <ActionForm action={markCampaignLaunchedAction} className="flex flex-wrap items-end gap-2 rounded-lg bg-emerald-50 p-2">
              {(state) => (
                <>
                  <input type="hidden" name="orgId" value={orgId} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <div className="flex-1">
                    <label className="field-label">Campaign ID/name from the ad platform</label>
                    <input className="field-input" name="externalCampaignId" placeholder="After creating it in Google Ads/Meta…" required />
                  </div>
                  <SubmitButton className="btn-primary px-3 py-2 text-sm" pendingLabel="Saving…">
                    <Rocket className="mr-1 inline h-3 w-3" /> Mark Launched
                  </SubmitButton>
                  <FormError message={state.error} />
                </>
              )}
            </ActionForm>
          )}

          {LAUNCHED_STATUSES.includes(campaign.status) && (
            <ActionForm action={updateCampaignPerformanceAction} className="grid gap-2 rounded-lg bg-ink-50 p-2 sm:grid-cols-5">
              {(state) => (
                <>
                  <input type="hidden" name="orgId" value={orgId} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <div>
                    <label className="field-label">Status</label>
                    <select name="status" className="field-input" defaultValue={campaign.status}>
                      {ADMIN_SETTABLE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Platform status</label>
                    <input className="field-input" name="externalPlatformStatus" defaultValue={campaign.external_platform_status ?? ""} />
                  </div>
                  <div>
                    <label className="field-label">Spend to date</label>
                    <input className="field-input" type="number" min="0" step="0.01" name="spendToDate" defaultValue={campaign.spend_to_date ?? ""} />
                  </div>
                  <div>
                    <label className="field-label">Clicks</label>
                    <input className="field-input" type="number" min="0" step="1" name="clicks" defaultValue={campaign.clicks ?? ""} />
                  </div>
                  <div>
                    <label className="field-label">Conversions</label>
                    <input className="field-input" type="number" min="0" step="1" name="conversions" defaultValue={campaign.conversions ?? ""} />
                  </div>
                  <div className="sm:col-span-5">
                    <SubmitButton className="btn-secondary px-3 py-2 text-sm" pendingLabel="Saving…">
                      Update Status/Performance
                    </SubmitButton>
                    <FormError message={state.error} />
                  </div>
                </>
              )}
            </ActionForm>
          )}

          <ApprovalHistory approvals={approvalsByCampaign.get(campaign.id) ?? []} />
        </div>
      ))}
    </div>
  );
}
