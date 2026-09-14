import { notFound } from "next/navigation";
import { FileText, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { VerificationReviewForm } from "@/components/admin/VerificationReviewForm";
import { PaymentReviewForm } from "@/components/admin/PaymentReviewForm";
import { ActivationPanel } from "@/components/admin/ActivationPanel";
import { BUSINESS_TYPE_LABELS, BUSINESS_TYPE_REQUIREMENTS } from "@/lib/constants/business";
import { BILLING_TERM_LABELS, formatInr } from "@/lib/constants/plans";
import { PLATFORM_LABELS } from "@/lib/constants/content";
import type { BusinessType } from "@/types/database";

export default async function AdminClientDetailPage({ params }: { params: { orgId: string } }) {
  const supabase = createClient();

  const { data: org } = await supabase.from("organizations").select("*").eq("id", params.orgId).single();
  if (!org) notFound();

  const [{ data: verification }, { data: subscription }, { data: payments }, { data: auditLogs }] = await Promise.all([
    supabase.from("business_verifications").select("*").eq("org_id", org.id).maybeSingle(),
    supabase.from("subscriptions").select("*, plans(name, code)").eq("org_id", org.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("payments").select("*").eq("org_id", org.id).order("submitted_at", { ascending: false }),
    supabase.from("audit_logs").select("*").eq("org_id", org.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const { data: documents } = verification
    ? await supabase.from("verification_documents").select("*").eq("verification_id", verification.id)
    : { data: [] };

  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data } = await supabase.storage.from("verification-documents").createSignedUrl(doc.storage_path, 300);
      return { ...doc, url: data?.signedUrl ?? null };
    })
  );

  const latestPayment = payments?.[0] ?? null;
  const paymentScreenshotUrl = latestPayment?.screenshot_path
    ? (await supabase.storage.from("payment-screenshots").createSignedUrl(latestPayment.screenshot_path, 300)).data?.signedUrl
    : null;

  const requirements = BUSINESS_TYPE_REQUIREMENTS[org.business_type as BusinessType];
  const docLabelByKey = new Map(requirements.documents.map((d) => [d.key, d.label]));

  const canActivate = verification?.status === "approved" && latestPayment?.status === "verified" && org.status === "pending_approval";

  const { data: brand } = org.status === "active"
    ? await supabase.from("brand_profiles").select("*").eq("org_id", org.id).maybeSingle()
    : { data: null };
  const { data: upcomingContent } = org.status === "active"
    ? await supabase
        .from("content_items")
        .select("id, platform, scheduled_date, status, source")
        .eq("org_id", org.id)
        .order("scheduled_date", { ascending: true })
        .limit(10)
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink-900">{org.legal_name}</h1>
          <StatusBadge status={org.status} />
        </div>
        <p className="text-sm text-ink-500">
          {BUSINESS_TYPE_LABELS[org.business_type as BusinessType]} · Registered{" "}
          {new Date(org.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="mb-3 text-lg font-semibold text-ink-900">Business Verification</h2>
            {verification ? (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <StatusBadge status={verification.status} />
                  {verification.reason && <span className="text-xs text-ink-500">Note: {verification.reason}</span>}
                </div>
                {Object.keys(verification.details ?? {}).length > 0 && (
                  <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(verification.details as Record<string, string>).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs uppercase text-ink-400">{key.replace(/_/g, " ")}</dt>
                        <dd className="text-ink-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="mb-4 space-y-2">
                  {documentsWithUrls.length === 0 && <p className="text-sm text-ink-400">No documents uploaded.</p>}
                  {documentsWithUrls.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm text-brand-700 hover:bg-ink-50"
                    >
                      <FileText className="h-4 w-4" />
                      {docLabelByKey.get(doc.doc_type) ?? doc.doc_type}
                    </a>
                  ))}
                </div>
                {(verification.status === "submitted" || verification.status === "pending_review") && (
                  <VerificationReviewForm verificationId={verification.id} orgId={org.id} />
                )}
              </>
            ) : (
              <p className="text-sm text-ink-400">Client has not submitted verification yet.</p>
            )}
          </section>

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold text-ink-900">Payment</h2>
            {latestPayment ? (
              <>
                <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs uppercase text-ink-400">Amount</div>
                    <div className="text-ink-800">{formatInr(latestPayment.amount)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-ink-400">Reference</div>
                    <div className="text-ink-800">{latestPayment.transaction_ref}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-ink-400">Date</div>
                    <div className="text-ink-800">{latestPayment.payment_date}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-ink-400">Status</div>
                    <StatusBadge status={latestPayment.status} />
                  </div>
                </div>
                {paymentScreenshotUrl && (
                  <a
                    href={paymentScreenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-4 flex w-fit items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm text-brand-700 hover:bg-ink-50"
                  >
                    <ImageIcon className="h-4 w-4" />
                    View screenshot
                  </a>
                )}
                {latestPayment.status === "pending_verification" && (
                  <PaymentReviewForm paymentId={latestPayment.id} orgId={org.id} />
                )}
              </>
            ) : (
              <p className="text-sm text-ink-400">No payment submitted yet.</p>
            )}
          </section>

          {org.status === "active" && (
            <section className="card">
              <h2 className="mb-3 text-lg font-semibold text-ink-900">Brand & Content (read-only)</h2>
              <p className="mb-3 text-xs text-ink-400">
                Support visibility only — approval and edits belong to the client.
              </p>
              {brand ? (
                <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase text-ink-400">Tone</dt>
                    <dd className="text-ink-800">{brand.preferred_tone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-ink-400">Target audience</dt>
                    <dd className="text-ink-800">{brand.target_audience ?? "—"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mb-4 text-sm text-ink-400">Brand Brain not set up yet.</p>
              )}
              <div className="space-y-1">
                {(upcomingContent ?? []).length === 0 && (
                  <p className="text-sm text-ink-400">No content planned in the next 7 days.</p>
                )}
                {(upcomingContent ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-ink-50 py-1.5 text-sm last:border-0">
                    <span className="text-ink-700">
                      {item.scheduled_date} · {PLATFORM_LABELS[item.platform as keyof typeof PLATFORM_LABELS]}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold text-ink-900">Audit Trail</h2>
            <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {(auditLogs ?? []).length === 0 && <p className="text-ink-400">No activity recorded yet.</p>}
              {(auditLogs ?? []).map((log) => (
                <div key={log.id} className="border-b border-ink-50 pb-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink-800">{log.action_type.replace(/_/g, " ")}</span>
                    <span className="text-xs text-ink-400">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-ink-500">Source: {log.source}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3 text-lg font-semibold text-ink-900">Package</h2>
            {subscription ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-500">Plan</dt>
                  <dd className="font-medium text-ink-900">{(subscription as any).plans?.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Billing</dt>
                  <dd className="text-ink-800">
                    {BILLING_TERM_LABELS[subscription.billing_term as keyof typeof BILLING_TERM_LABELS]}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Status</dt>
                  <dd>
                    <StatusBadge status={subscription.status} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Start</dt>
                  <dd className="text-ink-800">{subscription.start_date ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Expiry</dt>
                  <dd className="text-ink-800">{subscription.expiry_date ?? "—"}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-ink-400">No subscription found.</p>
            )}
          </section>

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold text-ink-900">Client Actions</h2>
            {org.status === "rejected" ? (
              <p className="text-sm text-ink-500">This application has been rejected.</p>
            ) : org.status === "active" ? (
              <p className="text-sm text-emerald-700">This client is active.</p>
            ) : (
              <ActivationPanel orgId={org.id} canActivate={canActivate} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
