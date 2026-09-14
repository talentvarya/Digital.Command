const STATUS_STYLES: Record<string, string> = {
  draft: "bg-ink-100 text-ink-700",
  pending_approval: "bg-amber-100 text-amber-800",
  pending_review: "bg-amber-100 text-amber-800",
  submitted: "bg-amber-100 text-amber-800",
  pending_verification: "bg-amber-100 text-amber-800",
  more_documents_required: "bg-orange-100 text-orange-800",
  active: "bg-emerald-100 text-emerald-800",
  verified: "bg-emerald-100 text-emerald-800",
  approved: "bg-emerald-100 text-emerald-800",
  paused: "bg-slate-200 text-slate-800",
  expired: "bg-slate-200 text-slate-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending Approval",
  pending_review: "Pending Review",
  pending_verification: "Pending Verification",
  more_documents_required: "More Documents Required",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-ink-100 text-ink-700";
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${style}`}>
      {label}
    </span>
  );
}
