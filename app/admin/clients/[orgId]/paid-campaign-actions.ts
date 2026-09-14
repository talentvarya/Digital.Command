"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAudit } from "@/lib/audit/log";
import { ADMIN_SETTABLE_STATUSES } from "@/lib/constants/paid-campaigns";
import type { ActionResult } from "@/app/register/actions";
import type { PaidCampaignStatus } from "@/types/database";

// Admin never sets draft/pending_approval/approved/rejected — those belong to
// the client alone (spec §14/§36, master prompt rule #6). RLS's admin update
// policy is broad (see 0015_phase6_rls.sql), so this allowlist check is the
// actual enforcement point for that rule on the admin side.
function isAdminSettableStatus(value: string): value is PaidCampaignStatus {
  return (ADMIN_SETTABLE_STATUSES as string[]).includes(value);
}

// Records that VMG staff actually created this campaign directly in Google
// Ads/Meta's own dashboard — Digital Command itself never calls an ad-platform
// API. Only campaigns the client has already approved can be marked launched.
export async function markCampaignLaunchedAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const orgId = formData.get("orgId") as string;
  const campaignId = formData.get("campaignId") as string;
  const externalCampaignId = (formData.get("externalCampaignId") as string)?.trim();
  if (!externalCampaignId) return { error: "Enter the campaign ID/name from the ad platform." };

  const { data: campaign } = await supabase.from("paid_campaigns").select("status").eq("id", campaignId).single();
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status !== "approved") return { error: "Only client-approved campaigns can be marked launched." };

  const { error } = await supabase
    .from("paid_campaigns")
    .update({
      status: "launched_externally",
      external_campaign_id: externalCampaignId,
      launched_by: admin.id,
      launched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: "paid_campaign_marked_launched",
    target: campaignId,
    newState: { externalCampaignId },
  });

  revalidatePath(`/admin/clients/${orgId}`);
  return {};
}

// Manual performance entry from what VMG sees in the ad platform's own
// dashboard — Phase 6 has no live API pull (see API_INTEGRATIONS.md).
export async function updateCampaignPerformanceAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const orgId = formData.get("orgId") as string;
  const campaignId = formData.get("campaignId") as string;
  const status = formData.get("status") as string;
  if (!isAdminSettableStatus(status)) return { error: "Invalid status." };

  const { data: campaign } = await supabase.from("paid_campaigns").select("status").eq("id", campaignId).single();
  if (!campaign) return { error: "Campaign not found." };
  if (!isAdminSettableStatus(campaign.status)) return { error: "Mark this campaign launched first." };

  const externalPlatformStatus = ((formData.get("externalPlatformStatus") as string) || "").trim() || null;
  const spendToDateRaw = formData.get("spendToDate") as string;
  const clicksRaw = formData.get("clicks") as string;
  const conversionsRaw = formData.get("conversions") as string;

  const { error } = await supabase
    .from("paid_campaigns")
    .update({
      status,
      external_platform_status: externalPlatformStatus,
      spend_to_date: spendToDateRaw ? Number(spendToDateRaw) : null,
      clicks: clicksRaw ? Number(clicksRaw) : null,
      conversions: conversionsRaw ? Number(conversionsRaw) : null,
      performance_updated_by: admin.id,
      performance_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: "paid_campaign_performance_updated",
    target: campaignId,
    newState: { status, externalPlatformStatus },
  });

  revalidatePath(`/admin/clients/${orgId}`);
  return {};
}
