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
  waiting_approval: "bg-amber-100 text-amber-800",
  scheduled: "bg-brand-100 text-brand-700",
  published: "bg-emerald-100 text-emerald-800",
  skipped: "bg-slate-200 text-slate-800",
  connected: "bg-emerald-100 text-emerald-800",
  not_added: "bg-slate-200 text-slate-800",
  reconnect_required: "bg-orange-100 text-orange-800",
  error: "bg-red-100 text-red-800",
  new: "bg-ink-100 text-ink-700",
  assessed: "bg-brand-100 text-brand-700",
  contacted: "bg-amber-100 text-amber-800",
  awaiting_response: "bg-amber-100 text-amber-800",
  link_acquired: "bg-emerald-100 text-emerald-800",
  declined: "bg-slate-200 text-slate-800",
  lost: "bg-red-100 text-red-800",
  sent: "bg-emerald-100 text-emerald-800",
  launched_externally: "bg-brand-100 text-brand-700",
  completed: "bg-emerald-100 text-emerald-800",
  healthy: "bg-emerald-100 text-emerald-800",
  offboarded: "bg-slate-200 text-slate-800",
  sandbox: "bg-purple-100 text-purple-700",
  needs_reply: "bg-amber-100 text-amber-800",
  drafted: "bg-brand-100 text-brand-700",
  posted: "bg-emerald-100 text-emerald-800",
  converted: "bg-emerald-100 text-emerald-800",
  not_interested: "bg-slate-200 text-slate-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending Approval",
  pending_review: "Pending Review",
  pending_verification: "Pending Verification",
  more_documents_required: "More Documents Required",
  waiting_approval: "Waiting Approval",
  not_added: "Not Added",
  reconnect_required: "Reconnect Required",
  awaiting_response: "Awaiting Response",
  link_acquired: "Link Acquired",
  launched_externally: "Launched",
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
