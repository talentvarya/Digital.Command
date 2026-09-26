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
  Star,
  Bot,
  Trophy,
  Gauge,
  CalendarClock,
  Activity,
  MousePointer2,
  Eye,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { ModuleLinkCard } from "@/components/client/ModuleLinkCard";
import { MasterStopPanel } from "@/components/client/MasterStopPanel";
import { CHART_COLORS } from "@/components/charts/StatCard";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { ApprovalQueue, type QueueItem } from "@/components/dashboard/ApprovalQueue";
import { ResultTile } from "@/components/dashboard/ResultTile";
import { BILLING_TERM_LABELS } from "@/lib/constants/plans";
import { PLATFORM_LABELS } from "@/lib/constants/content";
import { LOCAL_CITATION_DIRECTORIES } from "@/lib/constants/local-seo";
import { computeVisibility } from "@/lib/visibility/score";
import { getNapFields } from "@/lib/visibility/nap";
import {
  addDays,
  buildAttentionItems,
  comparableSeries,
  countInWindows,
  daysUntil,
  deriveAttentionInput,
  describeActivity,
  formatSlot,
  greetingFor,
  istDateString,
  pickApprovalQueue,
  spanDays,
  timeAgo,
  type UpcomingItem,
} from "@/lib/dashboard/command-center";
import type { ContentPlatform } from "@/types/database";

// Warm rotation for the tools grid, separate from CHART_COLORS' full
// categorical palette (which stays reserved for actual charts/legends) —
// blue/red/orange/yellow reads more energetic for a grid of clickable tiles.
const MODULE_COLORS = {
  blue: CHART_COLORS.blue,
  red: "#dc3d3d",
  orange: CHART_COLORS.orange,
  yellow: CHART_COLORS.yellow,
} as const;

const UPCOMING_DAYS = 14;
const LEADS_WINDOW_DAYS = 30;

const scoreColor = (v: number) => (v >= 80 ? "#1baf7a" : v >= 50 ? CHART_COLORS.yellow : "#dc3d3d");

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
  const orgId = membership.org_id;

  const now = new Date();
  const today = istDateString(now);
  const horizon = addDays(today, UPCOMING_DAYS);
  const since60 = new Date(now.getTime() - 2 * LEADS_WINDOW_DAYS * 86_400_000).toISOString();

  const [
    { data: org },
    { data: subscription },
    { data: verification },
    { data: settings },
    { data: auditLogs },
    { data: upcoming },
    { data: channelLinks },
    { data: googleConnections },
    { data: reviews },
    { data: brand },
    { data: gscRows },
    { data: gaRows },
    { data: leadEvents },
    { data: seoAudit },
    { data: aeoAudit },
    { data: localProfile },
  ] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).single(),
    supabase.from("subscriptions").select("*, plans(name)").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("business_verifications").select("status").eq("org_id", orgId).maybeSingle(),
    supabase.from("client_settings").select("*").eq("org_id", orgId).maybeSingle(),
    supabase.from("audit_logs").select("id, action_type, source, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(40),
    supabase
      .from("content_items")
      .select("id, platform, status, locked, publish_status, scheduled_date, scheduled_time, caption, content_media(storage_path)")
      .eq("org_id", orgId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", horizon)
      .in("status", ["draft", "waiting_approval", "approved", "scheduled"])
      .order("scheduled_date", { ascending: true })
      .limit(150),
    supabase.from("buffer_channel_links").select("platform").eq("org_id", orgId),
    supabase.from("google_connections").select("service, status").eq("org_id", orgId),
    supabase.from("reviews").select("rating, reply_status").eq("org_id", orgId),
    supabase.from("brand_profiles").select("logo_path, colors, phone, whatsapp").eq("org_id", orgId).maybeSingle(),
    supabase
      .from("search_console_snapshots")
      .select("date_range_start, date_range_end, total_clicks")
      .eq("org_id", orgId)
      .order("synced_at", { ascending: false })
      .limit(24),
    supabase
      .from("analytics_snapshots")
      .select("date_range_start, date_range_end, sessions")
      .eq("org_id", orgId)
      .order("synced_at", { ascending: false })
      .limit(24),
    supabase
      .from("conversion_events")
      .select("created_at")
      .eq("org_id", orgId)
      .in("event_type", ["lead", "sale", "booking"])
      .gte("created_at", since60),
    supabase.from("seo_audits").select("score").eq("org_id", orgId).order("crawled_at", { ascending: false }).limit(1),
    supabase.from("aeo_audits").select("score").eq("org_id", orgId).order("audited_at", { ascending: false }).limit(1),
    supabase.from("local_seo_profiles").select("address, city, state, pincode, gbp_url, citations_completed").eq("org_id", orgId).maybeSingle(),
  ]);

  if (!org) redirect("/pending");

  // ---- what needs attention -------------------------------------------------
  const items = (upcoming ?? []) as UpcomingItem[];
  const remaining = daysUntil(subscription?.expiry_date ?? null, now);
  const attention = buildAttentionItems(
    deriveAttentionInput({
      items,
      linkedPlatforms: (channelLinks ?? []).map((l) => l.platform),
      googleStatuses: (googleConnections ?? []).map((c) => c.status),
      reviews: reviews ?? [],
      brand,
      daysUntilExpiry: remaining,
    })
  );

  // ---- approval queue (with signed picture links) ---------------------------
  const queue = pickApprovalQueue(items);
  const queueItems: QueueItem[] = await Promise.all(
    queue.shown.map(async (item) => {
      const path = item.content_media?.[0]?.storage_path ?? null;
      const signed = path ? await supabase.storage.from("content-media").createSignedUrl(path, 300) : null;
      return {
        id: item.id,
        platform: PLATFORM_LABELS[item.platform as ContentPlatform] ?? item.platform,
        slot: formatSlot(item.scheduled_date, item.scheduled_time),
        caption: item.caption ?? "",
        imageUrl: signed?.data?.signedUrl ?? null,
      };
    })
  );
  // The queue is right below, so the list doesn't repeat "N posts are waiting".
  const attentionItems = queue.total > 0 ? attention.filter((a) => a.key !== "approvals") : attention;

  // ---- results --------------------------------------------------------------
  const clicks = comparableSeries(gscRows ?? [], (r) => r.total_clicks);
  const clicksDays = gscRows && gscRows.length > 0 ? spanDays(gscRows[0]) : null;
  const visits = comparableSeries(gaRows ?? [], (r) => r.sessions);
  const visitsDays = gaRows && gaRows.length > 0 ? spanDays(gaRows[0]) : null;

  const knownDirectories = new Set(LOCAL_CITATION_DIRECTORIES.map((d) => d.name));
  const nap = getNapFields({ local: localProfile, brand });
  const visibility = computeVisibility({
    seoScore: seoAudit?.[0]?.score ?? null,
    aeoScore: aeoAudit?.[0]?.score ?? null,
    napFilled: nap.filter((f) => f.filled).length,
    napTotal: nap.length,
    citationsDone: ((localProfile?.citations_completed as string[] | null) ?? []).filter((n) => knownDirectories.has(n)).length,
    citationsTotal: LOCAL_CITATION_DIRECTORIES.length,
  });

  const leads = countInWindows((leadEvents ?? []).map((e) => e.created_at), now, LEADS_WINDOW_DAYS);

  const ratings = (reviews ?? []).map((r) => r.rating).filter((r): r is number => typeof r === "number");
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const needReply = (reviews ?? []).filter((r) => r.reply_status === "needs_reply").length;

  const nextWeekEnd = addDays(today, 6);
  const scheduledThisWeek = items.filter((i) => i.status === "scheduled" && i.scheduled_date <= nextWeekEnd).length;

  // ---- what's been happening ------------------------------------------------
  const activity = (auditLogs ?? [])
    .map((log) => ({ id: log.id as string, text: describeActivity(log.action_type, log.source), at: log.created_at as string }))
    .filter((a): a is { id: string; text: string; at: string } => a.text !== null)
    .slice(0, 8);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-500">{greetingFor(now)}</p>
          <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{org.legal_name}</h1>
        </div>
        <MasterStopPanel masterStop={settings?.master_stop ?? false} />
      </div>

      <AttentionList items={attentionItems} />

      {queueItems.length > 0 && <ApprovalQueue items={queueItems} total={queue.total} />}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink-900">Your results</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ResultTile
            icon={MousePointer2}
            label="Clicks from Google"
            color={CHART_COLORS.blue}
            href="/app/seo"
            display={clicks.current === null ? null : clicks.current.toLocaleString("en-IN")}
            current={clicks.current}
            previous={clicks.previous}
            trend={clicks.values}
            caption={clicksDays ? `last ${clicksDays} days, from Search Console` : null}
            emptyText="Connect Google Search Console to see how many people click through to your website from Google."
          />
          <ResultTile
            icon={Eye}
            label="Website visits"
            color={CHART_COLORS.aqua}
            href="/app/seo"
            display={visits.current === null ? null : visits.current.toLocaleString("en-IN")}
            current={visits.current}
            previous={visits.previous}
            trend={visits.values}
            caption={visitsDays ? `last ${visitsDays} days, from Analytics` : null}
            emptyText="Connect Google Analytics to see how many visits your website gets."
          />
          <ResultTile
            icon={Gauge}
            label="Visibility score"
            color={visibility.overall === null ? CHART_COLORS.violet : scoreColor(visibility.overall)}
            href="/app/visibility"
            display={visibility.overall === null ? null : `${visibility.overall}/100`}
            caption={`based on ${visibility.measured} of 4 checks`}
            emptyText="Run an SEO audit or fill in your business details to get your first score."
          />
          <ResultTile
            icon={Users}
            label="Leads & sales"
            color={CHART_COLORS.orange}
            href="/app/conversions"
            display={String(leads.current)}
            current={leads.current}
            previous={leads.previous}
            caption={`last ${LEADS_WINDOW_DAYS} days, logged in Conversions`}
            emptyText=""
          />
          <ResultTile
            icon={Star}
            label="Reviews"
            color={CHART_COLORS.yellow}
            href="/app/reputation"
            display={avgRating === null ? null : `${avgRating.toFixed(1)} ★`}
            caption={
              avgRating === null
                ? null
                : `${ratings.length} logged${needReply > 0 ? ` · ${needReply} need${needReply === 1 ? "s" : ""} a reply` : ""}`
            }
            emptyText="Log the reviews you receive to see your average rating and reply to each one."
          />
          <ResultTile
            icon={CalendarClock}
            label="Posts lined up"
            color={CHART_COLORS.magenta}
            href="/app/planner"
            display={String(scheduledThisWeek)}
            caption="scheduled for the next 7 days"
            emptyText=""
          />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-ink-900">
          <Activity className="h-4 w-4 text-ink-400" />
          What&apos;s been happening
        </h2>
        <div className="text-sm">
          {activity.length === 0 && <p className="py-3 text-ink-400">Nothing yet — your activity will show up here as work gets done.</p>}
          {activity.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-ink-50 py-3 last:border-0">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS.blue }} />
              <span className="flex-1 text-ink-800">{a.text}</span>
              <span className="shrink-0 text-xs text-ink-400">{timeAgo(a.at, now)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-ink-900">Your account</h2>
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Package</dt>
            <dd className="mt-0.5 font-semibold text-ink-900">{(subscription as any)?.plans?.name ?? "—"}</dd>
            <dd className="text-ink-500">
              {subscription ? BILLING_TERM_LABELS[subscription.billing_term as keyof typeof BILLING_TERM_LABELS] : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Runs until</dt>
            <dd className="mt-0.5 font-semibold text-ink-900">{subscription?.expiry_date ?? "—"}</dd>
            <dd className="text-ink-500">
              {remaining === null ? "" : remaining < 0 ? "Ended" : remaining === 0 ? "Ends today" : `${remaining} ${remaining === 1 ? "day" : "days"} left`}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Business verification</dt>
            <dd className="mt-1">{verification ? <StatusBadge status={verification.status} /> : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Automation</dt>
            <dd className="mt-0.5 font-semibold text-ink-900">{settings?.automation_status ?? "Not started"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-900">All tools</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ModuleLinkCard icon={Palette} title="Brand Brain" subtitle="Voice, visuals & guardrails for AI content" href="/app/brand" color={MODULE_COLORS.blue} />
          <ModuleLinkCard icon={ClipboardList} title="Content Planner" subtitle="Generate, review, approve — publishes automatically via Buffer/YouTube once scheduled" href="/app/planner" color={MODULE_COLORS.red} />
          <ModuleLinkCard icon={Link2} title="Website & Channel Connections" subtitle="Add links, check they're reachable" href="/app/links" color={MODULE_COLORS.orange} />
          <ModuleLinkCard icon={Search} title="SEO" subtitle="Technical audit, Search Console & Analytics & YouTube connections, keyword tracking" href="/app/seo" color={MODULE_COLORS.yellow} />
          <ModuleLinkCard icon={FileBarChart} title="Reports" subtitle="Real data, AI-written summary — pick 7 days to 12 months" href="/app/reports" color={MODULE_COLORS.blue} />
          <ModuleLinkCard icon={Handshake} title="Off-Page & Outreach" subtitle="Brand mentions, opportunity assessment, personalized outreach, backlink checks" href="/app/outreach" color={MODULE_COLORS.red} />
          <ModuleLinkCard icon={Star} title="Reputation Management" subtitle="Send review requests, log reviews, AI-drafted replies you post yourself" href="/app/reputation" color={MODULE_COLORS.yellow} />
          <ModuleLinkCard icon={Megaphone} title="Paid Advertising" subtitle="AI-drafted campaign briefs, your budget, your approval — launch always stays manual" href="/app/paid-campaigns" color={MODULE_COLORS.orange} />
          <ModuleLinkCard icon={Sparkles} title="AI Assistant" subtitle="Ask about your report, edit or skip a post, draft something new" href="/app/assistant" color={MODULE_COLORS.yellow} />
          <ModuleLinkCard icon={MousePointerClick} title="Conversions" subtitle="Trackable WhatsApp/call/form links plus a real Google Organic → Sales funnel" href="/app/conversions" color={MODULE_COLORS.blue} />
          <ModuleLinkCard icon={HeartPulse} title="Connection Health" subtitle="One place to see what's connected, not added, or needs reconnecting" href="/app/health" color={MODULE_COLORS.red} />
          <ModuleLinkCard icon={MapPin} title="Local SEO Toolkit" subtitle="NAP consistency, citation checklist, AI-drafted Google Posts you post yourself" href="/app/local-seo" color={MODULE_COLORS.blue} />
          <ModuleLinkCard icon={Gauge} title="Visibility Score" subtitle="One number for how findable you are — SEO, AI-readiness, business info and directory listings" href="/app/visibility" color={MODULE_COLORS.red} />
          <ModuleLinkCard icon={Bot} title="AI Search Visibility" subtitle="Audit how AI-ready your site is, get AI-drafted FAQ content to add" href="/app/ai-visibility" color={MODULE_COLORS.orange} />
          {settings?.premium_apify_enabled && (
            <ModuleLinkCard icon={Trophy} title="Competitor Search" subtitle="Real Google results via your own Apify account — see where you and competitors rank" href="/app/competitor-search" color={MODULE_COLORS.yellow} />
          )}
        </div>
      </section>
    </div>
  );
}
