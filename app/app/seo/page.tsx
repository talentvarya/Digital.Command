import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuditPanel } from "@/components/seo/AuditPanel";
import { GoogleConnectionCard } from "@/components/seo/GoogleConnectionCard";
import { KeywordTracking } from "@/components/seo/KeywordTracking";
import { getValidAccessToken } from "@/lib/google/oauth";
import { listSearchConsoleSites } from "@/lib/google/search-console";
import { listAnalyticsProperties } from "@/lib/google/analytics";
import { syncSearchConsoleAction, syncAnalyticsAction } from "@/app/app/seo/actions";
import type { GoogleConnectionPublic } from "@/types/database";

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

  const [{ data: websiteLink }, { data: audits }, { data: connections }, { data: scSnapshots }] = await Promise.all([
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
  ]);

  const connectionByService = new Map(
    (connections as GoogleConnectionPublic[] | null ?? []).map((c) => [c.service, c])
  );
  const scConnection = connectionByService.get("search_console") ?? null;
  const gaConnection = connectionByService.get("analytics") ?? null;

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
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-semibold text-ink-900">Keyword Tracking</h2>
        <KeywordTracking latest={scSnapshots?.[0] ?? null} previous={scSnapshots?.[1] ?? null} />
      </div>
    </div>
  );
}
