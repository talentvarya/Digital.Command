import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuditPanel } from "@/components/seo/AuditPanel";
import { GoogleConnectionCard } from "@/components/seo/GoogleConnectionCard";
import { KeywordTracking } from "@/components/seo/KeywordTracking";
import { getValidAccessToken } from "@/lib/google/oauth";
import { listSearchConsoleSites } from "@/lib/google/search-console";
import { listAnalyticsProperties } from "@/lib/google/analytics";
import { listYoutubeChannels } from "@/lib/youtube/client";
import { syncSearchConsoleAction, syncAnalyticsAction } from "@/app/app/seo/actions";
import { PLATFORM_LABELS } from "@/lib/constants/content";
import { StatusBadge } from "@/components/StatusBadge";
import type { BufferPlatform, GoogleConnectionPublic } from "@/types/database";

export default async function SeoPage({
  searchParams,
}: {
  searchParams: { connected?: string; google_error?: string };
}) {
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

  const [{ data: websiteLink }, { data: audits }, { data: connections }, { data: scSnapshots }, { data: bufferLinks }] =
    await Promise.all([
      supabase.from("org_links").select("url").eq("org_id", orgId).eq("link_type", "website").maybeSingle(),
      supabase.from("seo_audits").select("*").eq("org_id", orgId).order("crawled_at", { ascending: false }).limit(1),
      supabase
        .from("google_connections")
        .select("id, org_id, service, external_property, status, last_synced_at")
        .eq("org_id", orgId),
      supabase
        .from("search_console_snapshots")
        .select("*")
        .eq("org_id", orgId)
        .order("synced_at", { ascending: false })
        .limit(2),
      supabase.from("buffer_channel_links").select("platform, buffer_channel_name").eq("org_id", orgId),
    ]);

  const connectionByService = new Map(
    (connections as GoogleConnectionPublic[] | null ?? []).map((c) => [c.service, c])
  );
  const scConnection = connectionByService.get("search_console") ?? null;
  const gaConnection = connectionByService.get("analytics") ?? null;
  const ytConnection = connectionByService.get("youtube") ?? null;
  const bufferLinkByPlatform = new Map((bufferLinks ?? []).map((l) => [l.platform as BufferPlatform, l.buffer_channel_name]));

  let scProperties: { id: string; label: string }[] | null = null;
  if (scConnection?.status === "connected" && !scConnection.external_property) {
    const token = await getValidAccessToken(supabase, orgId, "search_console");
    if (token) {
      try {
        const sites = await listSearchConsoleSites(token);
        scProperties = sites.map((s) => ({ id: s.siteUrl, label: s.siteUrl }));
      } catch {
        scProperties = [];
      }
    }
  }

  let gaProperties: { id: string; label: string }[] | null = null;
  if (gaConnection?.status === "connected" && !gaConnection.external_property) {
    const token = await getValidAccessToken(supabase, orgId, "analytics");
    if (token) {
      try {
        const props = await listAnalyticsProperties(token);
        gaProperties = props.map((p) => ({ id: p.propertyId, label: p.displayName }));
      } catch {
        gaProperties = [];
      }
    }
  }

  let ytChannels: { id: string; label: string }[] | null = null;
  if (ytConnection?.status === "connected" && !ytConnection.external_property) {
    const token = await getValidAccessToken(supabase, orgId, "youtube");
    if (token) {
      try {
        const channels = await listYoutubeChannels(token);
        ytChannels = channels.map((c) => ({ id: c.id, label: c.title }));
      } catch {
        ytChannels = [];
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">SEO</h1>
        <p className="text-sm text-ink-500">
          A real crawl-based technical audit, plus your own Google Search Console &amp; Analytics data once connected.
        </p>
        {searchParams.connected && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {searchParams.connected === "search_console" ? "Search Console" : "Analytics"} connected — choose a
            property below.
          </p>
        )}
        {searchParams.google_error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Google connection failed: {searchParams.google_error}
          </p>
        )}
      </div>

      <AuditPanel defaultUrl={websiteLink?.url ?? ""} latestAudit={audits?.[0] ?? null} />

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">Connected Services</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <GoogleConnectionCard
            service="search_console"
            connection={scConnection}
            properties={scProperties}
            syncAction={syncSearchConsoleAction}
          />
          <GoogleConnectionCard
            service="analytics"
            connection={gaConnection}
            properties={gaProperties}
            syncAction={syncAnalyticsAction}
          />
          <GoogleConnectionCard
            service="youtube"
            connection={ytConnection}
            properties={ytChannels}
            propertyLabel="channel"
          />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 text-lg font-semibold text-ink-900">Publishing</h2>
        <p className="mb-3 text-xs text-ink-500">
          Facebook/Instagram publish through VMG&apos;s Buffer account — ask your Digital Command contact to link
          your channel if it&apos;s not connected below.
        </p>
        <div className="space-y-1">
          {(["facebook", "instagram"] as BufferPlatform[]).map((platform) => {
            const channelName = bufferLinkByPlatform.get(platform);
            return (
              <div key={platform} className="flex items-center justify-between border-b border-ink-50 py-1.5 text-sm last:border-0">
                <span className="text-ink-700">{PLATFORM_LABELS[platform]}</span>
                {channelName ? (
                  <span className="flex items-center gap-2">
                    <StatusBadge status="connected" />
                    <span className="text-xs text-ink-500">{channelName}</span>
                  </span>
                ) : (
                  <StatusBadge status="not_added" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-semibold text-ink-900">Keyword Tracking</h2>
        <KeywordTracking latest={scSnapshots?.[0] ?? null} previous={scSnapshots?.[1] ?? null} />
      </div>
    </div>
  );
}
