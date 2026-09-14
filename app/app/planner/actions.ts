"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadOrgFile } from "@/lib/supabase/upload";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { generateCaption, findAvoidedWords, AiGenerationError } from "@/lib/ai/generate-content";
import { REJECTIONS_BEFORE_SUGGESTION, MONTHLY_AI_GENERATION_SAFETY_CAP } from "@/lib/constants/content";
import type { ActionResult } from "@/app/register/actions";
import type { BrandProfile, ContentControlMode, ContentPlatform } from "@/types/database";

function refresh() {
  revalidatePath("/app/planner");
}

function parseHashtags(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[,\s]+/)
    .map((h) => h.replace(/^#/, "").trim())
    .filter(Boolean);
}

async function getBrandAndSettings(supabase: ReturnType<typeof createClient>, orgId: string) {
  const [{ data: brand }, { data: settings }] = await Promise.all([
    supabase.from("brand_profiles").select("*").eq("org_id", orgId).maybeSingle(),
    supabase.from("client_settings").select("*").eq("org_id", orgId).maybeSingle(),
  ]);
  return {
    brand: (brand as BrandProfile | null) ?? null,
    controlMode: (settings?.content_control_mode as ContentControlMode | undefined) ?? "approval_required",
  };
}

// ============================================================================
// AI generation — first attempt or "Generate Another" / suggestion-based retry
// ============================================================================
export async function generateAiContentAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;
  const { userId, orgId } = member;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const { count: generationsThisMonth } = await supabase
    .from("content_versions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("generated_by", ["ai", "client_suggestion"])
    .gte("created_at", startOfMonth.toISOString());
  if ((generationsThisMonth ?? 0) >= MONTHLY_AI_GENERATION_SAFETY_CAP) {
    return {
      error: `Monthly AI generation limit reached (${MONTHLY_AI_GENERATION_SAFETY_CAP}). Contact support to raise it, or add your own content directly.`,
    };
  }

  const contentItemId = (formData.get("contentItemId") as string) || null;
  const clientSuggestion = ((formData.get("clientSuggestion") as string) || "").trim() || null;
  const { brand, controlMode } = await getBrandAndSettings(supabase, orgId);

  let itemId = contentItemId;
  let platform: ContentPlatform;
  let scheduledDate: string;
  let attemptNumber: number;
  let previousCaptions: string[] = [];

  if (contentItemId) {
    const { data: item } = await supabase
      .from("content_items")
      .select("*")
      .eq("id", contentItemId)
      .single();
    if (!item) return { error: "Content item not found." };
    if (item.locked) return { error: "This item is locked and can't be regenerated." };

    if (item.rejection_count >= REJECTIONS_BEFORE_SUGGESTION && !clientSuggestion) {
      return { error: "Please add your suggestion — three AI options have already been generated for this slot." };
    }

    const { data: versions } = await supabase
      .from("content_versions")
      .select("caption")
      .eq("content_item_id", contentItemId)
      .order("version_number", { ascending: false })
      .limit(3);
    previousCaptions = (versions ?? []).map((v) => v.caption).filter(Boolean) as string[];

    platform = item.platform;
    scheduledDate = item.scheduled_date;
    attemptNumber = item.rejection_count + 1;
  } else {
    platform = formData.get("platform") as ContentPlatform;
    scheduledDate = formData.get("scheduledDate") as string;
    attemptNumber = 1;
    if (!platform || !scheduledDate) return { error: "Platform and date are required." };
  }

  let generated;
  try {
    generated = await generateCaption({
      platform,
      brandProfile: brand,
      previousCaptions,
      clientSuggestion,
    });
  } catch (err) {
    if (err instanceof AiGenerationError) return { error: err.message };
    throw err;
  }

  const avoidedWords = findAvoidedWords(generated.caption, brand?.words_to_avoid ?? []);
  const heldForPolicy = controlMode === "autopilot" && avoidedWords.length > 0;
  const status = controlMode === "autopilot" && !heldForPolicy ? "scheduled" : "waiting_approval";

  if (!itemId) {
    const { data: newItem, error } = await supabase
      .from("content_items")
      .insert({
        org_id: orgId,
        platform,
        scheduled_date: scheduledDate,
        caption: generated.caption,
        hashtags: generated.hashtags,
        status,
        source: "ai_generated",
        control_mode: controlMode,
        rejection_count: attemptNumber,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !newItem) return { error: error?.message ?? "Could not create content item." };
    itemId = newItem.id;
  } else {
    const { error } = await supabase
      .from("content_items")
      .update({
        caption: generated.caption,
        hashtags: generated.hashtags,
        status,
        control_mode: controlMode,
        rejection_count: attemptNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);
    if (error) return { error: error.message };
  }

  const { data: versionRows } = await supabase
    .from("content_versions")
    .select("version_number")
    .eq("content_item_id", itemId)
    .order("version_number", { ascending: false })
    .limit(1);
  const nextVersion = (versionRows?.[0]?.version_number ?? 0) + 1;

  await supabase.from("content_versions").insert({
    content_item_id: itemId,
    org_id: orgId,
    version_number: nextVersion,
    caption: generated.caption,
    hashtags: generated.hashtags,
    generated_by: clientSuggestion ? "client_suggestion" : "ai",
    client_suggestion_text: clientSuggestion,
  });

  if (heldForPolicy) {
    await supabase.from("notifications").insert({
      org_id: orgId,
      type: "content_held_for_review",
      title: "AI content held for your review",
      body: `Autopilot generated a caption containing "${avoidedWords.join(", ")}" — it needs your approval instead of auto-scheduling.`,
    });
  }

  await logAudit(supabase, {
    orgId,
    actorUserId: userId,
    actorRole: "client_owner",
    source: "AUTOPILOT",
    actionType: "content_generated",
    target: itemId,
    newState: { status, attemptNumber, heldForPolicy },
  });

  refresh();
  return {};
}

// ============================================================================
// Client directly edits the caption/hashtags (spec §10 "Edit")
// ============================================================================
export async function editContentAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const caption = (formData.get("caption") as string) ?? "";
  const hashtags = parseHashtags(formData.get("hashtags"));

  const { data: item } = await supabase.from("content_items").select("locked").eq("id", id).single();
  if (item?.locked) return { error: "This item is locked and can't be edited." };

  const { error } = await supabase
    .from("content_items")
    .update({ caption, hashtags, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  const { data: versionRows } = await supabase
    .from("content_versions")
    .select("version_number")
    .eq("content_item_id", id)
    .order("version_number", { ascending: false })
    .limit(1);
  const nextVersion = (versionRows?.[0]?.version_number ?? 0) + 1;

  await supabase.from("content_versions").insert({
    content_item_id: id,
    org_id: member.orgId,
    version_number: nextVersion,
    caption,
    hashtags,
    generated_by: "client_edit",
  });

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "content_edited",
    target: id,
  });

  refresh();
  return {};
}

// ============================================================================
// Approve / Reject / Skip (spec §10)
// ============================================================================
export async function decideContentAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const decision = formData.get("decision") as "approve" | "reject" | "skip";

  const { data: before } = await supabase.from("content_items").select("status, locked").eq("id", id).single();
  if (before?.locked) return { error: "This item is locked." };

  const nextStatus = decision === "approve" ? "scheduled" : decision === "reject" ? "rejected" : "skipped";

  const { error } = await supabase
    .from("content_items")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: `content_${decision}d`,
    target: id,
    previousState: before ?? null,
    newState: { status: nextStatus },
  });

  refresh();
  return {};
}

// ============================================================================
// Client uploads their own content directly — skips AI/approval entirely
// (spec §11: "If client adds own content to a slot, Autopilot should not
// create duplicate content for the same slot" — since this action creates
// the slot's only item immediately at 'scheduled', there is nothing left for
// Autopilot to fill.)
// ============================================================================
export async function createManualContentAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;
  const { userId, orgId } = member;

  const platform = formData.get("platform") as ContentPlatform;
  const scheduledDate = formData.get("scheduledDate") as string;
  const caption = (formData.get("caption") as string) ?? "";
  const hashtags = parseHashtags(formData.get("hashtags"));
  const mediaFile = formData.get("media") as File | null;

  if (!platform || !scheduledDate) return { error: "Platform and date are required." };
  if (!caption.trim() && (!mediaFile || mediaFile.size === 0)) {
    return { error: "Add a caption or an image/video." };
  }

  const { data: item, error } = await supabase
    .from("content_items")
    .insert({
      org_id: orgId,
      platform,
      scheduled_date: scheduledDate,
      caption,
      hashtags,
      status: "scheduled",
      source: "client_uploaded",
      control_mode: "approval_required",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !item) return { error: error?.message ?? "Could not create content item." };

  if (mediaFile && mediaFile.size > 0) {
    try {
      const path = await uploadOrgFile(supabase, "content-media", orgId, mediaFile);
      await supabase.from("content_media").insert({
        content_item_id: item.id,
        org_id: orgId,
        media_type: mediaFile.type.startsWith("video") ? "video" : "image",
        storage_path: path,
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Media upload failed" };
    }
  }

  await logAudit(supabase, {
    orgId,
    actorUserId: userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "content_created_manually",
    target: item.id,
  });

  refresh();
  return {};
}

export async function removeContentMediaAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const mediaId = formData.get("mediaId") as string;
  const { error } = await supabase.from("content_media").delete().eq("id", mediaId);
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function addContentMediaAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const contentItemId = formData.get("contentItemId") as string;
  const file = formData.get("media") as File | null;
  if (!file || file.size === 0) return { error: "Choose a file first." };

  try {
    const path = await uploadOrgFile(supabase, "content-media", member.orgId, file);
    const { error } = await supabase.from("content_media").insert({
      content_item_id: contentItemId,
      org_id: member.orgId,
      media_type: file.type.startsWith("video") ? "video" : "image",
      storage_path: path,
    });
    if (error) return { error: error.message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Media upload failed" };
  }

  refresh();
  return {};
}

export async function deleteContentItemAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { data, error } = await supabase.from("content_items").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Could not delete — is it locked? Unlock it first." };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "content_deleted",
    target: id,
  });

  refresh();
  return {};
}

export async function toggleLockContentItemAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { data: item } = await supabase.from("content_items").select("locked").eq("id", id).single();
  if (!item) return { error: "Content item not found." };

  const { error } = await supabase.from("content_items").update({ locked: !item.locked }).eq("id", id);
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function rescheduleContentItemAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const scheduledDate = formData.get("scheduledDate") as string;
  const scheduledTime = (formData.get("scheduledTime") as string) || null;

  const { data: item } = await supabase.from("content_items").select("locked").eq("id", id).single();
  if (item?.locked) return { error: "This item is locked." };

  const { error } = await supabase
    .from("content_items")
    .update({ scheduled_date: scheduledDate, scheduled_time: scheduledTime, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function copyContentItemAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const targetDate = formData.get("targetDate") as string;
  if (!targetDate) return { error: "Choose a target date." };

  const { data: source } = await supabase.from("content_items").select("*").eq("id", id).single();
  if (!source) return { error: "Content item not found." };

  const { data: copy, error } = await supabase
    .from("content_items")
    .insert({
      org_id: member.orgId,
      platform: source.platform,
      scheduled_date: targetDate,
      caption: source.caption,
      hashtags: source.hashtags,
      status: "draft",
      source: source.source,
      control_mode: source.control_mode,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (error || !copy) return { error: error?.message ?? "Could not copy item." };

  const { data: media } = await supabase.from("content_media").select("media_type, storage_path").eq("content_item_id", id);
  if (media && media.length > 0) {
    await supabase
      .from("content_media")
      .insert(media.map((m) => ({ content_item_id: copy.id, org_id: member.orgId, media_type: m.media_type, storage_path: m.storage_path })));
  }

  refresh();
  return {};
}

// ============================================================================
// Autopilot / Approval Required mode switch (spec §10)
// ============================================================================
export async function setControlModeAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const mode = formData.get("mode") as ContentControlMode;
  const approvalThenAutopilot = formData.get("approvalThenAutopilot") === "true";

  const { error } = await supabase
    .from("client_settings")
    .update({
      content_control_mode: mode,
      approval_then_autopilot: approvalThenAutopilot,
      autopilot_since: mode === "autopilot" ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("org_id", member.orgId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "control_mode_changed",
    target: member.orgId,
    newState: { mode, approvalThenAutopilot },
  });

  refresh();
  return {};
}
