"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/app/register/actions";
import type { LinkType } from "@/types/database";

function refresh() {
  revalidatePath("/app/links");
}

export async function addLinkAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const linkType = formData.get("linkType") as LinkType;
  const url = (formData.get("url") as string)?.trim();
  const label = (formData.get("label") as string)?.trim() || null;
  if (!url) return { error: "URL is required" };

  const { error } = await supabase
    .from("org_links")
    .insert({ org_id: member.orgId, link_type: linkType, url, label, status: "not_added" });
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "link_added",
    target: linkType,
    newState: { url, label },
  });

  refresh();
  return {};
}

export async function updateLinkAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const url = (formData.get("url") as string)?.trim();
  const label = (formData.get("label") as string)?.trim() || null;
  if (!url) return { error: "URL is required" };

  const { error } = await supabase
    .from("org_links")
    .update({ url, label, status: "not_added", last_checked_at: null, last_check_result: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "link_updated",
    target: id,
    newState: { url, label },
  });

  refresh();
  return {};
}

export async function removeLinkAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { error } = await supabase.from("org_links").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "link_removed",
    target: id,
  });

  refresh();
  return {};
}

async function probeUrl(url: string): Promise<{ ok: boolean; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    return res.ok
      ? { ok: true, detail: `HTTP ${res.status}` }
      : { ok: false, detail: `HTTP ${res.status} ${res.statusText}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Request failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkLinkHealthAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { data: link } = await supabase.from("org_links").select("url").eq("id", id).single();
  if (!link) return { error: "Link not found" };

  let url = link.url as string;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const result = await probeUrl(url);
  const status = result.ok ? "connected" : "error";

  await supabase
    .from("org_links")
    .update({ status, last_checked_at: new Date().toISOString(), last_check_result: result.detail })
    .eq("id", id);

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "link_health_checked",
    target: id,
    newState: { status, detail: result.detail },
  });

  refresh();
  return {};
}
