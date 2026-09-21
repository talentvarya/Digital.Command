import Link from "next/link";
import { Users, ShieldAlert, Wallet, Hourglass, CheckCircle2, PauseCircle, CalendarX, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EmergencyFreezePanel } from "@/components/admin/EmergencyFreezePanel";
import { BUSINESS_TYPE_LABELS } from "@/lib/constants/business";
import { BILLING_TERM_LABELS } from "@/lib/constants/plans";
import { getConfigChecks, missingRequired } from "@/lib/admin/config-checks";
import type { OrganizationStatus } from "@/types/database";

export default async function AdminDashboardPage() {
  const supabase = createClient();

  const [{ data: orgs }, { data: verifications }, { data: payments }, { data: subscriptions }, { data: plans }, { data: settings }, { data: systemSettings }] =
    await Promise.all([
      supabase.from("organizations").select("id, legal_name, business_type, status, is_sandbox, created_at").order("created_at", { ascending: false }),
      supabase.from("business_verifications").select("org_id, status"),
      supabase.from("payments").select("org_id, status, submitted_at").order("submitted_at", { ascending: false }),
      supabase.from("subscriptions").select("org_id, plan_id, billing_term, start_date, expiry_date"),
      supabase.from("plans").select("id, name"),
      supabase.from("client_settings").select("org_id, automation_status"),
      supabase.from("system_settings").select("emergency_freeze, frozen_reason, frozen_at").single(),
    ]);

  const verificationByOrg = new Map((verifications ?? []).map((v) => [v.org_id, v.status]));
  const latestPaymentByOrg = new Map<string, string>();
  (payments ?? []).forEach((p) => {
    if (!latestPaymentByOrg.has(p.org_id)) latestPaymentByOrg.set(p.org_id, p.status);
  });
  const subscriptionByOrg = new Map((subscriptions ?? []).map((s) => [s.org_id, s]));
  const planNameById = new Map((plans ?? []).map((p) => [p.id, p.name]));
  const automationByOrg = new Map((settings ?? []).map((s) => [s.org_id, s.automation_status]));

  const orgList = orgs ?? [];
  const counts = {
    total: orgList.length,
    pendingVerification: orgList.filter((o) =>
      ["submitted", "pending_review", "more_documents_required"].includes(verificationByOrg.get(o.id) ?? "")
    ).length,
    pendingPayments: orgList.filter((o) => latestPaymentByOrg.get(o.id) === "pending_verification").length,
    pendingApproval: orgList.filter((o) => o.status === "pending_approval").length,
    active: orgList.filter((o) => o.status === "active").length,
    paused: orgList.filter((o) => o.status === "paused").length,
    expired: orgList.filter((o) => o.status === "expired").length,
    rejected: orgList.filter((o) => o.status === "rejected").length,
  };

  const configProblems = missingRequired(getConfigChecks(process.env));

  return (
    <div className="space-y-8">
      {configProblems.length > 0 && (
        <Link
          href="/admin/health"
          className="block rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 hover:bg-red-100"
        >
          {configProblems.length} required deployment setting{configProblems.length > 1 ? "s are" : " is"} missing (
          {configProblems.map((c) => c.key).join(", ")}) — parts of the app are broken. See Config Health.
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Super Admin Dashboard</h1>
          <p className="text-sm text-ink-500">Review registrations, verify documents and payments, and manage client accounts.</p>
        </div>
        <EmergencyFreezePanel
          frozen={systemSettings?.emergency_freeze ?? false}
          frozenReason={systemSettings?.frozen_reason ?? null}
          frozenAt={systemSettings?.frozen_at ?? null}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Clients" value={counts.total} icon={Users} />
        <StatCard label="Pending Verification" value={counts.pendingVerification} icon={ShieldAlert} tone="warning" />
        <StatCard label="Pending Payments" value={counts.pendingPayments} icon={Wallet} tone="warning" />
        <StatCard label="Pending Approval" value={counts.pendingApproval} icon={Hourglass} tone="warning" />
        <StatCard label="Active" value={counts.active} icon={CheckCircle2} tone="success" />
        <StatCard label="Paused" value={counts.paused} icon={PauseCircle} />
        <StatCard label="Expired" value={counts.expired} icon={CalendarX} />
        <StatCard label="Rejected" value={counts.rejected} icon={XCircle} tone="danger" />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Business Type</th>
              <th className="px-4 py-3">Package</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3">Automation</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orgList.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink-400">
                  No clients have registered yet.
                </td>
              </tr>
            )}
            {orgList.map((org) => {
              const sub = subscriptionByOrg.get(org.id);
              const verificationStatus = verificationByOrg.get(org.id);
              const paymentStatus = latestPaymentByOrg.get(org.id);
              const automation = automationByOrg.get(org.id);
              return (
                <tr key={org.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    <div className="flex items-center gap-2">
                      {org.legal_name}
                      <StatusBadge status={org.status as OrganizationStatus} />
                      {org.is_sandbox && <StatusBadge status="sandbox" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{BUSINESS_TYPE_LABELS[org.business_type as keyof typeof BUSINESS_TYPE_LABELS]}</td>
                  <td className="px-4 py-3 text-ink-600">
                    {sub ? `${planNameById.get(sub.plan_id) ?? "—"} (${BILLING_TERM_LABELS[sub.billing_term as keyof typeof BILLING_TERM_LABELS]})` : "—"}
                  </td>
                  <td className="px-4 py-3">{paymentStatus ? <StatusBadge status={paymentStatus} /> : "—"}</td>
                  <td className="px-4 py-3">{verificationStatus ? <StatusBadge status={verificationStatus} /> : "—"}</td>
                  <td className="px-4 py-3 text-ink-600">{automation ?? "Not started"}</td>
                  <td className="px-4 py-3 text-ink-600">{sub?.start_date ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-600">{sub?.expiry_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/clients/${org.id}`} className="font-medium text-brand-600 hover:underline">
                      Review
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
