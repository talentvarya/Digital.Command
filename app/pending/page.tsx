import { redirect } from "next/navigation";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { StatusBadge } from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationStatus } from "@/types/database";

const CLOSED_MESSAGES: Partial<Record<OrganizationStatus, string>> = {
  offboarded:
    "This account has been closed (offboarded). Your data is kept, not deleted — contact your Digital Command contact if you need an export or want to come back.",
  paused: "This account is paused. Contact your Digital Command contact to resume it.",
  expired: "This subscription has expired. Contact your Digital Command contact to renew.",
};

function StepIcon({ done, active }: { done: boolean; active: boolean }) {
  if (done) return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (active) return <Clock className="h-5 w-5 text-amber-600" />;
  return <Circle className="h-5 w-5 text-ink-300" />;
}

export default async function PendingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/register/details");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, legal_name, status")
    .eq("id", membership.org_id)
    .single();

  if (org?.status === "active") redirect("/app/dashboard");

  // An offboarded/paused/expired account isn't "waiting for approval" — showing
  // the registration-review steps to it (which is what every non-active status
  // used to get) is simply the wrong message.
  const closedMessage = org?.status ? CLOSED_MESSAGES[org.status as OrganizationStatus] : undefined;
  if (closedMessage) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-xl font-bold text-ink-900">{org?.legal_name}</h1>
            {org?.status && <StatusBadge status={org.status} />}
          </div>
          <p className="text-sm text-ink-600">{closedMessage}</p>
        </div>
      </main>
    );
  }

  const { data: verification } = await supabase
    .from("business_verifications")
    .select("status, reason")
    .eq("org_id", membership.org_id)
    .maybeSingle();

  const { data: payment } = await supabase
    .from("payments")
    .select("status, reason")
    .eq("org_id", membership.org_id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const verificationDone = verification?.status === "approved";
  const paymentDone = payment?.status === "verified";
  const approvalDone = org?.status === "active";

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <div className="card">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink-900">{org?.legal_name}</h1>
          {org?.status && <StatusBadge status={org.status} />}
        </div>
        <p className="mb-6 text-sm text-ink-500">
          Your registration is being reviewed. You&apos;ll be able to access your dashboard once a Super Admin
          approves your account.
        </p>

        <ol className="space-y-4">
          <li className="flex items-start gap-3">
            <StepIcon done active={false} />
            <div>
              <div className="text-sm font-medium text-ink-900">Registration submitted</div>
              <div className="text-xs text-ink-500">Policies accepted, business details recorded.</div>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <StepIcon done={verificationDone} active={!verificationDone} />
            <div>
              <div className="text-sm font-medium text-ink-900">Business verification</div>
              <div className="text-xs text-ink-500">
                {verification ? <StatusBadge status={verification.status} /> : "Not started"}
              </div>
              {verification?.reason && (
                <div className="mt-1 text-xs text-red-600">Reviewer note: {verification.reason}</div>
              )}
            </div>
          </li>
          <li className="flex items-start gap-3">
            <StepIcon done={paymentDone} active={!paymentDone} />
            <div>
              <div className="text-sm font-medium text-ink-900">Payment verification</div>
              <div className="text-xs text-ink-500">
                {payment ? <StatusBadge status={payment.status} /> : "Not submitted"}
              </div>
              {payment?.reason && <div className="mt-1 text-xs text-red-600">Reviewer note: {payment.reason}</div>}
            </div>
          </li>
          <li className="flex items-start gap-3">
            <StepIcon done={approvalDone} active={verificationDone && paymentDone && !approvalDone} />
            <div>
              <div className="text-sm font-medium text-ink-900">Super Admin approval</div>
              <div className="text-xs text-ink-500">Final activation of your account.</div>
            </div>
          </li>
        </ol>

        {org?.status === "rejected" && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Your application was not approved. Please contact support for details.
          </div>
        )}
      </div>
    </main>
  );
}
