import { redirect } from "next/navigation";
import {
  Search,
  Link2,
  MapPin,
  FileBarChart,
  Palette,
  ClipboardList,
  Handshake,
  Megaphone,
  Sparkles,
  HeartPulse,
  MousePointerClick,
  Package,
  CalendarClock,
  Hourglass,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { ComingSoonCard } from "@/components/client/ComingSoonCard";
import { ModuleLinkCard } from "@/components/client/ModuleLinkCard";
import { MasterStopPanel } from "@/components/client/MasterStopPanel";
import { CHART_COLORS } from "@/components/charts/StatCard";
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{org.legal_name}</h1>
          <p className="text-sm text-ink-500">Welcome back — here&apos;s where your account stands.</p>
        </div>
        <MasterStopPanel masterStop={settings?.master_stop ?? false} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border border-ink-100 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: CHART_COLORS.blue }} />
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${CHART_COLORS.blue}1a`, color: CHART_COLORS.blue }}>
            <Package className="h-3.5 w-3.5" />
          </div>
          <div className="text-xs uppercase text-ink-400">Package</div>
          <div className="text-lg font-semibold text-ink-900">{(subscription as any)?.plans?.name ?? "—"}</div>
          <div className="text-xs text-ink-500">
            {subscription ? BILLING_TERM_LABELS[subscription.billing_term as keyof typeof BILLING_TERM_LABELS] : ""}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-ink-100 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: CHART_COLORS.violet }} />
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${CHART_COLORS.violet}1a`, color: CHART_COLORS.violet }}>
            <CalendarClock className="h-3.5 w-3.5" />
          </div>
          <div className="text-xs uppercase text-ink-400">Start / Expiry</div>
          <div className="text-sm text-ink-900">{subscription?.start_date ?? "—"}</div>
          <div className="text-sm text-ink-500">to {subscription?.expiry_date ?? "—"}</div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-ink-100 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: CHART_COLORS.aqua }} />
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${CHART_COLORS.aqua}1a`, color: CHART_COLORS.aqua }}>
            <Hourglass className="h-3.5 w-3.5" />
          </div>
          <div className="text-xs uppercase text-ink-400">Remaining Days</div>
          <div className="text-2xl font-bold text-ink-900 [font-variant-numeric:tabular-nums]">{remaining ?? "—"}</div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-ink-100 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: CHART_COLORS.orange }} />
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${CHART_COLORS.orange}1a`, color: CHART_COLORS.orange }}>
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
          <div className="text-xs uppercase text-ink-400">Verification</div>
          <div className="mt-1">{verification ? <StatusBadge status={verification.status} /> : "—"}</div>
          <div className="mt-2 text-xs uppercase text-ink-400">Automation</div>
          <div className="text-sm text-ink-800">{settings?.automation_status ?? "Not started"}</div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-900">Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModuleLinkCard icon={Palette} title="Brand Brain" subtitle="Voice, visuals & guardrails for AI content" href="/app/brand" color={CHART_COLORS.violet} />
          <ModuleLinkCard icon={ClipboardList} title="Content Planner" subtitle="Generate, review, approve — publishes automatically via Buffer/YouTube once scheduled" href="/app/planner" color={CHART_COLORS.blue} />
          <ModuleLinkCard icon={Link2} title="Website & Channel Connections" subtitle="Add links, check they're reachable" href="/app/links" color={CHART_COLORS.magenta} />
          <ModuleLinkCard icon={Search} title="SEO" subtitle="Technical audit, Search Console & Analytics & YouTube connections, keyword tracking" href="/app/seo" color={CHART_COLORS.aqua} />
          <ModuleLinkCard icon={FileBarChart} title="Reports" subtitle="Real data, AI-written summary — every 7 or 14 days" href="/app/reports" color={CHART_COLORS.aqua} />
          <ModuleLinkCard icon={Handshake} title="Off-Page & Outreach" subtitle="Brand mentions, opportunity assessment, personalized outreach, backlink checks" href="/app/outreach" color={CHART_COLORS.aqua} />
          <ModuleLinkCard icon={Megaphone} title="Paid Advertising" subtitle="AI-drafted campaign briefs, your budget, your approval — launch always stays manual" href="/app/paid-campaigns" color={CHART_COLORS.orange} />
          <ModuleLinkCard icon={Sparkles} title="AI Assistant" subtitle="Ask about your report, edit or skip a post, draft something new" href="/app/assistant" color={CHART_COLORS.blue} />
          <ModuleLinkCard icon={MousePointerClick} title="Conversions" subtitle="Trackable WhatsApp/call/form links plus a real Google Organic → Sales funnel" href="/app/conversions" color={CHART_COLORS.yellow} />
          <ModuleLinkCard icon={HeartPulse} title="Connection Health" subtitle="One place to see what's connected, not added, or needs reconnecting" href="/app/health" color={CHART_COLORS.magenta} />
          <ComingSoonCard icon={MapPin} title="Local SEO / Google Business Profile" />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-ink-900">
          <Activity className="h-4 w-4 text-ink-400" />
          Recent Activity
        </h2>
        <div className="space-y-0.5 text-sm">
          {(auditLogs ?? []).length === 0 && <p className="text-ink-400">No activity recorded yet.</p>}
          {(auditLogs ?? []).map((log, i) => (
            <div key={log.id} className="flex items-center gap-3 border-b border-ink-50 py-2.5 last:border-0">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: Object.values(CHART_COLORS)[i % Object.values(CHART_COLORS).length] }}
              />
              <span className="flex-1 text-ink-800">{log.action_type.replace(/_/g, " ")}</span>
              <span className="shrink-0 text-xs text-ink-400 [font-variant-numeric:tabular-nums]">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
