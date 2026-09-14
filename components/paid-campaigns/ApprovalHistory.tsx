import { BUDGET_PERIOD_LABELS } from "@/lib/constants/paid-campaigns";
import { formatInr } from "@/lib/constants/plans";
import type { PaidCampaignApproval } from "@/types/database";

export function ApprovalHistory({ approvals }: { approvals: PaidCampaignApproval[] }) {
  if (approvals.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-ink-50 pt-3">
      <div className="text-xs font-medium uppercase text-ink-400">Approval history</div>
      {approvals.map((a) => (
        <div key={a.id} className="rounded-lg bg-ink-50 p-2 text-xs text-ink-600">
          <div className="flex items-center justify-between">
            <span className={`font-medium ${a.decision === "approved" ? "text-emerald-700" : "text-red-700"}`}>
              v{a.approval_version} · {a.decision === "approved" ? "Approved" : "Rejected"}
            </span>
            <span className="text-ink-400">{new Date(a.created_at).toLocaleString()}</span>
          </div>
          {a.decision === "approved" && a.max_spend !== null && (
            <div className="mt-0.5 text-ink-500">
              Authorized up to {formatInr(a.max_spend)} ({a.budget_period ? BUDGET_PERIOD_LABELS[a.budget_period] : "—"}) · {a.start_date} to{" "}
              {a.end_date}
            </div>
          )}
          {a.decision === "rejected" && a.reason && <div className="mt-0.5 text-ink-500">Reason: {a.reason}</div>}
        </div>
      ))}
    </div>
  );
}
