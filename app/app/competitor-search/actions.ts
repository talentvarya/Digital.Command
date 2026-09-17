"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { runCompetitorSearch, ApifyError } from "@/lib/apify/client";
import type { ActionResult } from "@/app/register/actions";

function refresh() {
  revalidatePath("/app/competitor-search");
}

async function requirePremiumApify(supabase: ReturnType<typeof createClient>, orgId: string): Promise<ActionResult | null> {
  const { data } = await supabase.from("client_settings").select("premium_apify_enabled").eq("org_id", orgId).maybeSingle();
  if (!data?.premium_apify_enabled) {
    return { error: "Competitor Search is a premium add-on — ask your Digital Command contact to enable it for your account." };
  }
  return null;
}

export async function saveApifyTokenAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const gate = await requirePremiumApify(supabase, member.orgId);
  if (gate) return gate;

  const apiToken = ((formData.get("apiToken") as string) || "").trim();
  if (!apiToken) return { error: "Enter your Apify API token." };

  const { error } = await supabase.from("apify_connections").upsert({
    org_id: member.orgId,
    api_token: apiToken,
    status: "connected",
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "apify_connected",
  });

  refresh();
  return {};
}

export async function disconnectApifyAction(_prevState: ActionResult, _formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const { error } = await supabase
    .from("apify_connections")
    .update({ api_token: null, status: "not_added", updated_at: new Date().toISOString() })
    .eq("org_id", member.orgId);
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function runCompetitorSearchAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const gate = await requirePremiumApify(supabase, member.orgId);
  if (gate) return gate;

  const automation = await checkAutomationAllowed(supabase, member.orgId);
  if (!automation.allowed) return { error: automation.reason };

  const query = ((formData.get("query") as string) || "").trim();
  const countryCode = ((formData.get("countryCode") as string) || "in").trim();
  if (!query) return { error: "Enter a search term (e.g. \"chocolate shop pune\")." };

  const [{ data: connection }, { data: websiteLink }] = await Promise.all([
    supabase.from("apify_connections").select("api_token, status").eq("org_id", member.orgId).maybeSingle(),
    supabase.from("org_links").select("url").eq("org_id", member.orgId).eq("link_type", "website").maybeSingle(),
  ]);
  if (!connection?.api_token || connection.status !== "connected") {
    return { error: "Connect your Apify account first." };
  }

  let ownDomain: string | null = null;
  if (websiteLink?.url) {
    try {
      ownDomain = new URL(websiteLink.url).hostname.replace(/^www\./, "");
    } catch {
      ownDomain = null;
    }
  }

  let result;
  try {
    result = await runCompetitorSearch({ apiToken: connection.api_token, query, countryCode, ownDomain });
  } catch (err) {
    if (err instanceof ApifyError) {
      await supabase.from("apify_connections").update({ status: "error", updated_at: new Date().toISOString() }).eq("org_id", member.orgId);
      return { error: err.message };
    }
    throw err;
  }

  const { error } = await supabase.from("apify_search_snapshots").insert({
    org_id: member.orgId,
    query,
    country_code: countryCode,
    own_domain: ownDomain,
    own_domain_position: result.ownDomainPosition,
    top_results: result.topResults,
    triggered_by: member.userId,
  });
  if (error) return { error: error.message };

  await supabase.from("apify_connections").update({ last_used_at: new Date().toISOString() }).eq("org_id", member.orgId);

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "competitor_search_run",
    target: query,
    newState: { ownDomainPosition: result.ownDomainPosition, resultCount: result.topResults.length },
  });

  refresh();
  return {};
}
