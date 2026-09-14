import { redirect } from "next/navigation";
import { Search, Link2, Share2, Youtube, MapPin, FileBarChart, Palette, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { ComingSoonCard } from "@/components/client/ComingSoonCard";
import { ModuleLinkCard } from "@/components/client/ModuleLinkCard";
import { BILLING_TERM_LABELS } from "@/lib/constants/plans";

function daysRemaining(expiry: string | null): number | null {
  if (!expiry) return null;
  const diff = new Date(expiry).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default async function ClientDashboardPage() {
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

  const [{ data: org }, { data: subscription }, { data: verification }, { data: settings }, { data: auditLogs }] =
    await Promise.all([
      supabase.from("organizations").select("*").eq("id", membership.org_id).single(),
      supabase
        .from("subscriptions")
        .select("*, plans(name)")
        .eq("org_id", membership.org_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("business_verifications").select("status").eq("org_id", membership.org_id).maybeSingle(),
      supabase.from("client_settings").select("*").eq("org_id", membership.org_id).maybeSingle(),
      supabase
        .from("audit_logs")
        .select("*")
        .eq("org_id", membership.org_id)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

  if (!org) redirect("/pending");

  const remaining = daysRemaining(subscription?.expiry_date ?? null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{org.legal_name}</h1>
        <p className="text-sm text-ink-500">Welcome back — here&apos;s where your account stands.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="text-xs uppercase text-ink-400">Package</div>
          <div className="text-lg font-semibold text-ink-900">{(subscription as any)?.plans?.name ?? "—"}</div>
          <div className="text-xs text-ink-500">
            {subscription ? BILLING_TERM_LABELS[subscription.billing_term as keyof typeof BILLING_TERM_LABELS] : ""}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-ink-400">Start / Expiry</div>
          <div className="text-sm text-ink-900">{subscription?.start_date ?? "—"}</div>
          <div className="text-sm text-ink-500">to {subscription?.expiry_date ?? "—"}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-ink-400">Remaining Days</div>
          <div className="text-2xl font-bold text-ink-900">{remaining ?? "—"}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-ink-400">Verification</div>
          <div className="mt-1">{verification ? <StatusBadge status={verification.status} /> : "—"}</div>
          <div className="mt-2 text-xs uppercase text-ink-400">Automation</div>
          <div className="text-sm text-ink-800">{settings?.automation_status ?? "Not started"}</div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-900">Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModuleLinkCard icon={Palette} title="Brand Brain" subtitle="Voice, visuals & guardrails for AI content" href="/app/brand" />
          <ModuleLinkCard icon={ClipboardList} title="7-Day Content Planner" subtitle="Generate, review & approve — includes your approval queue" href="/app/planner" />
          <ModuleLinkCard icon={Link2} title="Website & Channel Connections" subtitle="Add links, check they're reachable" href="/app/links" />
          <ModuleLinkCard icon={Search} title="SEO" subtitle="Technical audit, Search Console & Analytics, keyword tracking" href="/app/seo" />
          <ModuleLinkCard icon={FileBarChart} title="Reports" subtitle="Real data, AI-written summary — every 7 or 14 days" href="/app/reports" />
          <ComingSoonCard icon={Link2} title="Off-Page SEO" />
          <ComingSoonCard icon={Share2} title="SMO Publishing (Facebook / Instagram)" />
          <ComingSoonCard icon={Youtube} title="YouTube" />
          <ComingSoonCard icon={MapPin} title="Local SEO / Google Business Profile" />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-ink-900">Recent Activity</h2>
        <div className="space-y-2 text-sm">
          {(auditLogs ?? []).length === 0 && <p className="text-ink-400">No activity recorded yet.</p>}
          {(auditLogs ?? []).map((log) => (
            <div key={log.id} className="flex items-center justify-between border-b border-ink-50 pb-2 last:border-0">
              <span className="text-ink-800">{log.action_type.replace(/_/g, " ")}</span>
              <span className="text-xs text-ink-400">{new Date(log.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
