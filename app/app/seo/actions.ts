"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { runSeoAudit } from "@/lib/seo/audit";
import { getValidAccessToken } from "@/lib/google/oauth";
import { fetchSearchConsoleSnapshot } from "@/lib/google/search-console";
import { fetchAnalyticsSnapshot } from "@/lib/google/analytics";
import type { ActionResult } from "@/app/register/actions";
import type { GoogleService } from "@/types/database";

function refresh() {
  revalidatePath("/app/seo");
}

export async function runAuditAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const automation = await checkAutomationAllowed(supabase, member.orgId);
  if (!automation.allowed) return { error: automation.reason };

  let url = (formData.get("url") as string)?.trim();
  if (!url) return { error: "Enter a website URL to audit." };
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  let result;
  try {
    result = await runSeoAudit(url);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Audit failed" };
  }

  const { error } = await supabase.from("seo_audits").insert({
    org_id: member.orgId,
    url,
    score: result.score,
    issues: result.issues,
    triggered_by: member.userId,
  });
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "seo_audit_run",
    target: url,
    newState: { score: result.score, issueCount: result.issues.length },
  });

  refresh();
  return {};
}

export async function selectGooglePropertyAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const service = formData.get("service") as GoogleService;
  const property = formData.get("property") as string;
  if (!property) return { error: "Choose a property." };

  const { error } = await supabase
    .from("google_connections")
    .update({ external_property: property, updated_at: new Date().toISOString() })
    .eq("org_id", member.orgId)
    .eq("service", service);
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function syncSearchConsoleAction(
  _prevState: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const accessToken = await getValidAccessToken(supabase, member.orgId, "search_console");
  if (!accessToken) return { error: "Search Console isn't connected — connect it first." };

  const { data: connection } = await supabase
    .from("google_connections")
    .select("external_property")
    .eq("org_id", member.orgId)
    .eq("service", "search_console")
    .maybeSingle();
  if (!connection?.external_property) return { error: "Choose a Search Console property first." };

  let snapshot;
  try {
    snapshot = await fetchSearchConsoleSnapshot(accessToken, connection.external_property);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed" };
  }

  const { error } = await supabase.from("search_console_snapshots").insert({
    org_id: member.orgId,
    site_url: snapshot.siteUrl,
    date_range_start: snapshot.dateRangeStart,
    date_range_end: snapshot.dateRangeEnd,
    total_clicks: snapshot.totalClicks,
    total_impressions: snapshot.totalImpressions,
    avg_ctr: snapshot.avgCtr,
    avg_position: snapshot.avgPosition,
    top_queries: snapshot.topQueries,
    top_pages: snapshot.topPages,
  });
  if (error) return { error: error.message };

  await supabase
    .from("google_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("org_id", member.orgId)
    .eq("service", "search_console");

  refresh();
  return {};
}

export async function syncAnalyticsAction(_prevState: ActionResult, _formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const accessToken = await getValidAccessToken(supabase, member.orgId, "analytics");
  if (!accessToken) return { error: "Analytics isn't connected — connect it first." };

  const { data: connection } = await supabase
    .from("google_connections")
    .select("external_property")
    .eq("org_id", member.orgId)
    .eq("service", "analytics")
    .maybeSingle();
  if (!connection?.external_property) return { error: "Choose an Analytics property first." };

  let snapshot;
  try {
    snapshot = await fetchAnalyticsSnapshot(accessToken, connection.external_property);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed" };
  }

  const { error } = await supabase.from("analytics_snapshots").insert({
    org_id: member.orgId,
    property_id: snapshot.propertyId,
    date_range_start: snapshot.dateRangeStart,
    date_range_end: snapshot.dateRangeEnd,
    sessions: snapshot.sessions,
    users: snapshot.users,
    conversions: snapshot.conversions,
    top_pages: snapshot.topPages,
  });
  if (error) return { error: error.message };

  await supabase
    .from("google_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("org_id", member.orgId)
    .eq("service", "analytics");

  refresh();
  return {};
}

export async function disconnectGoogleServiceAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const service = formData.get("service") as GoogleService;
  const { error } = await supabase
    .from("google_connections")
    .delete()
    .eq("org_id", member.orgId)
    .eq("service", service);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "google_service_disconnected",
    target: service,
  });

  refresh();
  return {};
}
