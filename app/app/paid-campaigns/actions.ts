"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { prepareCampaignDraft } from "@/lib/ai/prepare-campaign";
import { AiGenerationError } from "@/lib/ai/client";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ActionResult } from "@/app/register/actions";
import type { AdPlatform, BrandProfile, BudgetPeriod } from "@/types/database";

function refresh() {
  revalidatePath("/app/paid-campaigns");
}

function parseKeywords(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[,\n]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function parseMoney(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function nextApprovalVersion(supabase: ReturnType<typeof createClient>, campaignId: string): Promise<number> {
  const { data } = await supabase
    .from("paid_campaign_approvals")
    .select("approval_version")
    .eq("campaign_id", campaignId)
    .order("approval_version", { ascending: false })
    .limit(1);
  return (data?.[0]?.approval_version ?? 0) + 1;
}

// ============================================================================
// AI drafts a starting point — never authorizes anything by itself. Budget
// guidance comes back as qualitative notes only (see lib/ai/prepare-campaign.ts);
// the client sets the real, binding max_spend later, at Approve time.
// ============================================================================
export async function prepareCampaignAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;
  const { userId, orgId } = member;

  const name = (formData.get("name") as string)?.trim();
  const platform = formData.get("platform") as AdPlatform;
  const objective = (formData.get("objective") as string)?.trim();
  const goalDescription = (formData.get("goalDescription") as string)?.trim() ?? "";
  if (!name) return { error: "Give this campaign a name." };
  if (!platform) return { error: "Choose a platform." };
  if (!objective) return { error: "Choose or describe an objective." };

  const { data: brand } = await supabase.from("brand_profiles").select("*").eq("org_id", orgId).maybeSingle();

  let draft;
  try {
    draft = await prepareCampaignDraft({ platform, objective, goalDescription, brandProfile: (brand as BrandProfile | null) ?? null });
  } catch (err) {
    if (err instanceof AiGenerationError) return { error: err.message };
    throw err;
  }
  await logAiUsage(supabase, { orgId, feature: "campaign_brief", usage: draft.usage });

  const { data: campaign, error } = await supabase
    .from("paid_campaigns")
    .insert({
      org_id: orgId,
      platform,
      name,
      objective,
      audience_description: draft.audienceDescription,
      keywords: draft.keywords,
      creative_brief: draft.creativeBrief,
      suggested_budget_notes: draft.suggestedBudgetNotes,
      status: "draft",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !campaign) return { error: error?.message ?? "Could not create this campaign." };

  await logAudit(supabase, {
    orgId,
    actorUserId: userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "paid_campaign_drafted",
    target: campaign.id,
    newState: { platform, name, objective },
  });

  refresh();
  return {};
}

// ============================================================================
// Edit draft fields, including the client-set budget/date authorization
// fields. Editing a decided campaign (approved or rejected) resubmits it —
// an approval is only ever valid for the exact parameters it covered.
// ============================================================================
export async function updateCampaignAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { data: current } = await supabase.from("paid_campaigns").select("status").eq("id", id).single();
  if (!current) return { error: "Campaign not found." };
  if (["launched_externally", "paused", "completed", "cancelled"].includes(current.status)) {
    return { error: "This campaign has already moved past approval — VMG is tracking it externally now. Contact VMG if changes are needed." };
  }

  const name = (formData.get("name") as string)?.trim();
  const platform = formData.get("platform") as AdPlatform;
  const objective = (formData.get("objective") as string)?.trim();
  if (!name) return { error: "Give this campaign a name." };
  if (!platform) return { error: "Choose a platform." };
  if (!objective) return { error: "Choose or describe an objective." };

  const budgetPeriodRaw = formData.get("budgetPeriod") as string;
  const budgetPeriod: BudgetPeriod | null = budgetPeriodRaw === "daily" || budgetPeriodRaw === "total_campaign" ? budgetPeriodRaw : null;

  const nextStatus = current.status === "approved" || current.status === "rejected" ? "pending_approval" : current.status;

  const { error } = await supabase
    .from("paid_campaigns")
    .update({
      name,
      platform,
      objective,
      audience_description: ((formData.get("audienceDescription") as string) || "").trim() || null,
      keywords: parseKeywords(formData.get("keywords")),
      creative_brief: ((formData.get("creativeBrief") as string) || "").trim() || null,
      max_spend: parseMoney(formData.get("maxSpend")),
      budget_period: budgetPeriod,
      start_date: (formData.get("startDate") as string) || null,
      end_date: (formData.get("endDate") as string) || null,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "paid_campaign_updated",
    target: id,
    previousState: { status: current.status },
    newState: { status: nextStatus },
  });

  refresh();
  return {};
}

export async function submitForApprovalAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { data: current } = await supabase.from("paid_campaigns").select("status").eq("id", id).single();
  if (!current) return { error: "Campaign not found." };
  if (current.status !== "draft") return { error: "Only drafts can be submitted for approval." };

  const { error } = await supabase
    .from("paid_campaigns")
    .update({ status: "pending_approval", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "paid_campaign_submitted_for_approval",
    target: id,
  });

  refresh();
  return {};
}

// ============================================================================
// The single most safety-critical action in this app — this is the only
// place a campaign can become 'approved', and only an org member can call it
// (paid_campaigns_update_admin has no path to this status; see 0015_phase6_rls.sql).
// Requires the client's own binding budget/date fields to already be set, plus
// an explicit confirmation checkbox. Never itself contacts an ad platform.
// ============================================================================
export async function approveCampaignAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const confirmed = formData.get("confirmAuthorization") === "true";

  const { data: campaign } = await supabase.from("paid_campaigns").select("*").eq("id", id).single();
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status !== "pending_approval") return { error: "This campaign must be submitted for approval first." };
  if (!campaign.max_spend || !campaign.budget_period || !campaign.start_date || !campaign.end_date) {
    return { error: "Set a maximum spend, budget period, start date, and end date before approving." };
  }
  if (!confirmed) return { error: "Please confirm you understand this authorizes real ad spend up to the limit above." };

  const approvalVersion = await nextApprovalVersion(supabase, id);
  const { ipAddress, userAgent } = getRequestMeta();

  const { error: approvalError } = await supabase.from("paid_campaign_approvals").insert({
    campaign_id: id,
    org_id: member.orgId,
    decision: "approved",
    approval_version: approvalVersion,
    max_spend: campaign.max_spend,
    budget_period: campaign.budget_period,
    start_date: campaign.start_date,
    end_date: campaign.end_date,
    approved_by: member.userId,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
  if (approvalError) return { error: approvalError.message };

  const { error } = await supabase
    .from("paid_campaigns")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "paid_campaign_approved",
    target: id,
    newState: { approvalVersion, maxSpend: campaign.max_spend, budgetPeriod: campaign.budget_period, startDate: campaign.start_date, endDate: campaign.end_date },
  });

  refresh();
  return {};
}

export async function rejectCampaignAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const reason = (formData.get("reason") as string)?.trim();
  if (!reason) return { error: "A reason is required to reject." };

  const { data: campaign } = await supabase.from("paid_campaigns").select("status").eq("id", id).single();
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status !== "pending_approval") return { error: "This campaign is not awaiting approval." };

  const approvalVersion = await nextApprovalVersion(supabase, id);
  const { ipAddress, userAgent } = getRequestMeta();

  const { error: approvalError } = await supabase.from("paid_campaign_approvals").insert({
    campaign_id: id,
    org_id: member.orgId,
    decision: "rejected",
    reason,
    approval_version: approvalVersion,
    approved_by: member.userId,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
  if (approvalError) return { error: approvalError.message };

  const { error } = await supabase
    .from("paid_campaigns")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "paid_campaign_rejected",
    target: id,
    newState: { reason },
  });

  refresh();
  return {};
}

export async function deleteCampaignAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { data, error } = await supabase.from("paid_campaigns").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Only draft campaigns can be deleted — this one has already been submitted." };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "paid_campaign_deleted",
    target: id,
  });

  refresh();
  return {};
}
