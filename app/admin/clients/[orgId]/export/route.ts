import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

// Placed inside the /admin App Router segment (not /api/admin/...) so it
// inherits the same Super-Admin-role-plus-forced-MFA gate every other admin
// page gets from middleware.ts's path-prefix check, rather than only
// self-checking login the way a route outside /admin would. Exports
// business/marketing records for spec §29's offboarding "export client
// reports/assets" step — deliberately not verification documents or payment
// screenshots (raw KYC material), just the operational data itself.
export async function GET(_request: Request, { params }: { params: { orgId: string } }) {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: 403 });
  }

  const orgId = params.orgId;

  const [
    { data: org },
    { data: subscription },
    { data: brand },
    { data: links },
    { data: content },
    { data: reports },
    { data: seoAudits },
    { data: searchConsole },
    { data: analytics },
    { data: opportunities },
    { data: outreach },
    { data: campaigns },
    { data: campaignApprovals },
  ] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).single(),
    supabase.from("subscriptions").select("*, plans(name, code)").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.from("brand_profiles").select("*").eq("org_id", orgId).maybeSingle(),
    supabase.from("org_links").select("*").eq("org_id", orgId),
    supabase.from("content_items").select("*").eq("org_id", orgId).order("scheduled_date", { ascending: true }),
    supabase.from("reports").select("*").eq("org_id", orgId).order("generated_at", { ascending: false }),
    supabase.from("seo_audits").select("url, score, issues, crawled_at").eq("org_id", orgId).order("crawled_at", { ascending: false }),
    supabase
      .from("search_console_snapshots")
      .select("site_url, date_range_start, date_range_end, total_clicks, total_impressions, avg_position")
      .eq("org_id", orgId)
      .order("synced_at", { ascending: false }),
    supabase
      .from("analytics_snapshots")
      .select("property_id, date_range_start, date_range_end, sessions, users, conversions")
      .eq("org_id", orgId)
      .order("synced_at", { ascending: false }),
    supabase.from("off_page_opportunities").select("*").eq("org_id", orgId),
    supabase.from("outreach_messages").select("*").eq("org_id", orgId),
    supabase.from("paid_campaigns").select("*").eq("org_id", orgId),
    supabase.from("paid_campaign_approvals").select("*").eq("org_id", orgId),
  ]);

  if (!org) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const exportBundle = {
    exportedAt: new Date().toISOString(),
    organization: org,
    subscriptions: subscription ?? [],
    brandProfile: brand ?? null,
    links: links ?? [],
    contentItems: content ?? [],
    reports: reports ?? [],
    seoAudits: seoAudits ?? [],
    searchConsoleSnapshots: searchConsole ?? [],
    analyticsSnapshots: analytics ?? [],
    offPageOpportunities: opportunities ?? [],
    outreachMessages: outreach ?? [],
    paidCampaigns: campaigns ?? [],
    paidCampaignApprovals: campaignApprovals ?? [],
  };

  return new NextResponse(JSON.stringify(exportBundle, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="digital-command-export-${orgId}.json"`,
    },
  });
}
