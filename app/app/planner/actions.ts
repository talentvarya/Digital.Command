"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { uploadOrgFile } from "@/lib/supabase/upload";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { checkAutomationAllowed, isEmergencyFrozen } from "@/lib/automation/guard";
import { generateCaption, findAvoidedWords, AiGenerationError } from "@/lib/ai/generate-content";
import { logAiUsage } from "@/lib/ai/log-usage";
import {
  REJECTIONS_BEFORE_SUGGESTION,
  MONTHLY_AI_GENERATION_SAFETY_CAP,
  PLATFORM_LABELS,
  TIME_SLOTS,
  AUTOPILOT_BUFFER_DAYS,
  AUTOPILOT_REFILL_AT_DAYS,
} from "@/lib/constants/content";
import { dispatchToPublisher } from "@/lib/publishing/dispatch";
import { resolveDueAt } from "@/lib/publishing/schedule";
import { computeBufferState, slotKey } from "@/lib/planner/buffer";
import { cleanFreeText, tryWithOptionalColumn } from "@/lib/planner/optional-column";
import { istDateString, nextDays } from "@/lib/utils/ist";
import { findOccasion } from "@/lib/occasions/calendar";
import { pickSlot } from "@/lib/occasions/plan";
import { attachUnsplashPhoto, captionToImageQuery } from "@/lib/unsplash/attach";
import { getBufferPostStatus, getBufferPostMetrics, BufferApiError } from "@/lib/buffer/client";
import { getValidAccessToken } from "@/lib/google/oauth";
import { getYoutubeVideoStatus } from "@/lib/youtube/client";
import type { ActionResult } from "@/app/register/actions";
import type { BrandProfile, ContentControlMode, ContentItem, ContentPlatform } from "@/types/database";

function refresh() {
  revalidatePath("/app/planner");
  // The client home lists posts waiting for approval, with Approve buttons of its own.
  revalidatePath("/app/dashboard");
}

function parseHashtags(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[,\s]+/)
    .map((h) => h.replace(/^#/, "").trim())
    .filter(Boolean);
}

export async function getBrandAndSettings(supabase: SupabaseClient, orgId: string) {
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
// Shared core: generate one caption for one slot and persist it. Used by both
// the single-slot form action below and the Autopilot "fill this week" bulk
// action — kept as one function so the two never drift on the status/policy/
// dispatch logic.
// ============================================================================
export async function generateOneSlot(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    userId: string;
    platform: ContentPlatform;
    scheduledDate: string;
    controlMode: ContentControlMode;
    brand: BrandProfile | null;
    itemId?: string | null;
    attemptNumber?: number;
    previousCaptions?: string[];
    clientSuggestion?: string | null;
    scheduledTime?: string | null;
    // Who/what actually triggered this — a human clicking a button
    // (default) vs the unattended daily Autopilot cron. Audit trail only;
    // doesn't change behavior.
    auditSource?: "CLIENT_MANUAL" | "AUTOPILOT";
    // A festival/occasion the client chose to plan this post for.
    occasion?: { name: string; date: string; angle?: string | null } | null;
  }
): Promise<{ error: string } | { itemId: string }> {
  const { orgId, userId, platform, scheduledDate, controlMode, brand } = params;
  const attemptNumber = params.attemptNumber ?? 1;
  const clientSuggestion = params.clientSuggestion ?? null;
  let itemId = params.itemId ?? null;

  let generated;
  try {
    generated = await generateCaption({
      platform,
      brandProfile: brand,
      previousCaptions: params.previousCaptions ?? [],
      clientSuggestion,
      occasion: params.occasion ?? null,
    });
  } catch (err) {
    if (err instanceof AiGenerationError) return { error: err.message };
    throw err;
  }
  await logAiUsage(supabase, { orgId, feature: "content_generation", usage: generated.usage });

  const avoidedWords = findAvoidedWords(generated.caption, brand?.words_to_avoid ?? []);
  const heldForPolicy = controlMode === "autopilot" && avoidedWords.length > 0;
  const status = controlMode === "autopilot" && !heldForPolicy ? "scheduled" : "waiting_approval";

  let savedItem: ContentItem;
  if (!itemId) {
    const newRow = {
      org_id: orgId,
      platform,
      scheduled_date: scheduledDate,
      scheduled_time: params.scheduledTime ?? null,
      caption: generated.caption,
      hashtags: generated.hashtags,
      status,
      source: "ai_generated",
      control_mode: controlMode,
      rejection_count: attemptNumber,
      created_by: userId,
    };
    // The AI's suggested picture (image_prompt) needs migration 0038; without it
    // the post is still created, just without the idea.
    const { data: newItem, error } = await tryWithOptionalColumn(
      "image_prompt",
      () => supabase.from("content_items").insert({ ...newRow, image_prompt: generated.imageIdea }).select("*").single(),
      () => supabase.from("content_items").insert(newRow).select("*").single()
    );
    if (error || !newItem) return { error: error?.message ?? "Could not create content item." };
    itemId = newItem.id;
    savedItem = newItem;
  } else {
    const { data: updatedItem, error } = await supabase
      .from("content_items")
      .update({
        caption: generated.caption,
        hashtags: generated.hashtags,
        status,
        control_mode: controlMode,
        rejection_count: attemptNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .select("*")
      .single();
    if (error || !updatedItem) return { error: error?.message ?? "Could not update content item." };
    savedItem = updatedItem;

    // A regenerated caption keeps whatever picture description the post already has
    // (the client may have written it); the AI's idea only fills an empty one.
    // Best-effort, and harmless before migration 0038 (the column isn't there yet).
    if (generated.imageIdea) {
      await supabase.from("content_items").update({ image_prompt: generated.imageIdea }).eq("id", itemId).is("image_prompt", null);
    }
  }
  if (!itemId) return { error: "Could not resolve content item id." };

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

  // Auto-attach a free stock photo matching the caption — only when this
  // slot has no media yet, so regenerating a caption never piles up extra
  // photos. Best-effort (see attachUnsplashPhoto's own doc comment): a
  // missing/unconfigured UNSPLASH_ACCESS_KEY or a search miss never fails
  // the generation that already succeeded.
  const { count: existingMediaCount } = await supabase
    .from("content_media")
    .select("id", { count: "exact", head: true })
    .eq("content_item_id", itemId);
  if (!existingMediaCount) {
    await attachUnsplashPhoto(supabase, {
      orgId,
      contentItemId: itemId,
      query: captionToImageQuery(generated.imageIdea ?? generated.caption, platform),
    });
  }

  if (status === "scheduled") {
    await dispatchToPublisher(supabase, savedItem);
  }

  const auditSource = params.auditSource ?? "CLIENT_MANUAL";
  await logAudit(supabase, {
    orgId,
    actorUserId: userId,
    actorRole: auditSource === "AUTOPILOT" ? "autopilot" : "client_owner",
    source: auditSource,
    actionType: "content_generated",
    target: itemId,
    newState: { status, attemptNumber, heldForPolicy },
  });

  return { itemId };
}

// Why AI writing can't run for this business right now (a Master STOP, an
// Emergency Freeze, or the monthly safety cap), or null when it can.
async function generationBlockedReason(supabase: SupabaseClient, orgId: string): Promise<string | null> {
  const automation = await checkAutomationAllowed(supabase, orgId);
  if (!automation.allowed) return automation.reason;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const { count: generationsThisMonth } = await supabase
    .from("content_versions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("generated_by", ["ai", "client_suggestion", "gpt_assistant"])
    .gte("created_at", startOfMonth.toISOString());
  if ((generationsThisMonth ?? 0) >= MONTHLY_AI_GENERATION_SAFETY_CAP) {
    return `Monthly AI generation limit reached (${MONTHLY_AI_GENERATION_SAFETY_CAP}). Contact support to raise it, or add your own content directly.`;
  }
  return null;
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

  const blocked = await generationBlockedReason(supabase, orgId);
  if (blocked) return { error: blocked };

  const contentItemId = (formData.get("contentItemId") as string) || null;
  const clientSuggestion = ((formData.get("clientSuggestion") as string) || "").trim() || null;
  const { brand, controlMode } = await getBrandAndSettings(supabase, orgId);

  let platform: ContentPlatform;
  let scheduledDate: string;
  let attemptNumber: number;
  let previousCaptions: string[] = [];
  let scheduledTime: string | null = null;

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
    scheduledTime = (formData.get("scheduledTime") as string) || null;
    attemptNumber = 1;
    if (!platform || !scheduledDate) return { error: "Platform and date are required." };
  }

  const result = await generateOneSlot(supabase, {
    orgId,
    userId,
    platform,
    scheduledDate,
    controlMode,
    brand,
    itemId: contentItemId,
    attemptNumber,
    previousCaptions,
    clientSuggestion,
    scheduledTime,
  });
  if ("error" in result) return result;

  refresh();
  return {};
}

// ============================================================================
// "Plan a post" for a festival or occasion — the client presses the button, so
// nothing is ever planned for a festival on the business's behalf. The post goes
// through the same approval flow as any other: waiting for approval, or scheduled
// if the business is on Autopilot.
// ============================================================================
export async function planOccasionPostAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;
  const { userId, orgId } = member;

  const occasion = findOccasion(String(formData.get("occasionKey") ?? ""));
  if (!occasion) return { error: "That occasion wasn't found." };
  const platform = String(formData.get("platform") ?? "") as ContentPlatform;
  if (platform !== "facebook" && platform !== "instagram") return { error: "Choose Facebook or Instagram." };
  if (occasion.date < istDateString()) return { error: `${occasion.name} has already passed.` };

  const blocked = await generationBlockedReason(supabase, orgId);
  if (blocked) return { error: blocked };

  const slot = pickSlot(occasion.date, TIME_SLOTS.map((s) => s.value), (date, time) => !resolveDueAt({ scheduled_date: date, scheduled_time: time }).ok);
  if (!slot) return { error: `Today's posting times have already passed, so ${occasion.name} can't be planned for today. Add a post by hand, or plan the next occasion.` };

  // One post per platform per occasion: never quietly add a second on top of the first.
  const { data: already } = await supabase
    .from("content_items")
    .select("id")
    .eq("org_id", orgId)
    .eq("platform", platform)
    .eq("scheduled_date", occasion.date)
    .not("status", "in", "(rejected,skipped)")
    .limit(1);
  // "a Facebook post" but "an Instagram post"
  const aPost = `${platform === "instagram" ? "an" : "a"} ${PLATFORM_LABELS[platform]} post`;
  if (already && already.length > 0) {
    return { error: `You already have ${aPost} planned for ${occasion.name} — open it in the planner below.` };
  }

  const { brand, controlMode } = await getBrandAndSettings(supabase, orgId);
  const result = await generateOneSlot(supabase, {
    orgId,
    userId,
    platform,
    scheduledDate: occasion.date,
    scheduledTime: slot,
    controlMode,
    brand,
    occasion: { name: occasion.name, date: occasion.date, angle: occasion.angle },
  });
  if ("error" in result) return result;

  refresh();
  return {
    message: `${aPost.charAt(0).toUpperCase()}${aPost.slice(1)} for ${occasion.name} is ready — ${
      controlMode === "autopilot" ? "it's scheduled." : "it's waiting for your approval in the planner below."
    }`,
  };
}

// ============================================================================
// Shared buffer logic for both the manual "Fill next 7 days" button and the
// daily Autopilot cron. Autopilot NEVER generates a client's whole planning
// window (which can be up to 90 days) in one shot — that's what was blowing
// through Unsplash's 50-requests/hour limit. Instead it keeps a rolling
// buffer of at most AUTOPILOT_BUFFER_DAYS days of content generated ahead of
// today. `force: true` (the manual button) fills whatever's missing in that
// buffer right now; `force: false` (the cron) only tops it up once the
// buffer has shrunk to AUTOPILOT_REFILL_AT_DAYS or fewer days remaining —
// either way, it never touches more than AUTOPILOT_BUFFER_DAYS days.
// ============================================================================
export async function fillAutopilotBuffer(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    userId: string;
    platforms: ContentPlatform[];
    controlMode: ContentControlMode;
    brand: BrandProfile | null;
    remainingCap: number;
    auditSource?: "CLIENT_MANUAL" | "AUTOPILOT";
    force?: boolean;
  }
): Promise<{ created: number; bufferDays: number; lastError: string | null }> {
  const { orgId, userId, platforms, controlMode, brand } = params;
  let remaining = params.remainingCap;

  const days = nextDays(AUTOPILOT_BUFFER_DAYS);

  const { data: existing } = await supabase
    .from("content_items")
    .select("platform, scheduled_date, scheduled_time")
    .eq("org_id", orgId)
    .gte("scheduled_date", days[0])
    .lte("scheduled_date", days[days.length - 1]);

  // How many consecutive days, starting today, already have every selected
  // platform/slot filled — the actual size of the current buffer. (See
  // computeBufferState for why slot times are normalised before comparing.)
  const slotIsPast = (date: string, time: string) => !resolveDueAt({ scheduled_date: date, scheduled_time: time }).ok;
  const { filled, bufferDays } = computeBufferState({
    existing: existing ?? [],
    days,
    platforms,
    slotTimes: TIME_SLOTS.map((s) => s.value),
    isPast: slotIsPast,
  });

  if (!params.force && bufferDays > AUTOPILOT_REFILL_AT_DAYS) {
    return { created: 0, bufferDays, lastError: null };
  }

  let created = 0;
  let lastError: string | null = null;
  for (const date of days) {
    for (const platform of platforms) {
      for (const slot of TIME_SLOTS) {
        if (remaining <= 0) break;
        if (filled.has(slotKey(date, platform, slot.value, TIME_SLOTS[0].value))) continue;
        if (slotIsPast(date, slot.value)) continue; // a slot that has already gone can't be posted into

        const result = await generateOneSlot(supabase, {
          orgId,
          userId,
          platform,
          scheduledDate: date,
          controlMode,
          brand,
          scheduledTime: slot.value,
          auditSource: params.auditSource,
        });
        remaining -= 1;
        if ("error" in result) {
          lastError = result.error;
        } else {
          created += 1;
        }
      }
    }
  }

  return { created, bufferDays, lastError };
}

// ============================================================================
// Autopilot "Fill next 7 days" — a manual, on-demand top-up of the same
// rolling buffer the daily cron maintains automatically (see
// fillAutopilotBuffer above and app/api/cron/planner-fill/route.ts). Always
// capped at AUTOPILOT_BUFFER_DAYS regardless of the client's planning-window
// selection — Autopilot never bulk-generates a 30/60/90-day window at once.
// ============================================================================
export async function runAutopilotFillAction(_prevState: ActionResult, _formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;
  const { userId, orgId } = member;

  const automation = await checkAutomationAllowed(supabase, orgId);
  if (!automation.allowed) return { error: automation.reason };

  const { data: settings } = await supabase
    .from("client_settings")
    .select("content_control_mode, autopilot_platforms")
    .eq("org_id", orgId)
    .maybeSingle();
  const controlMode = (settings?.content_control_mode as ContentControlMode | undefined) ?? "approval_required";
  const platforms = (settings?.autopilot_platforms as ContentPlatform[] | undefined) ?? [];

  if (controlMode !== "autopilot") return { error: "Switch to Autopilot mode first." };
  if (platforms.length === 0) return { error: "Pick at least one platform for Autopilot to fill first." };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const { count: generationsThisMonth } = await supabase
    .from("content_versions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("generated_by", ["ai", "client_suggestion", "gpt_assistant"])
    .gte("created_at", startOfMonth.toISOString());
  const remaining = MONTHLY_AI_GENERATION_SAFETY_CAP - (generationsThisMonth ?? 0);
  if (remaining <= 0) {
    return {
      error: `Monthly AI generation limit reached (${MONTHLY_AI_GENERATION_SAFETY_CAP}). Contact support to raise it, or add your own content directly.`,
    };
  }

  const { brand } = await getBrandAndSettings(supabase, orgId);

  const { created, lastError } = await fillAutopilotBuffer(supabase, {
    orgId,
    userId,
    platforms,
    controlMode,
    brand,
    remainingCap: remaining,
    auditSource: "CLIENT_MANUAL",
    force: true,
  });

  refresh();
  if (created === 0) {
    return { error: lastError ?? `Nothing to fill — the next ${AUTOPILOT_BUFFER_DAYS} days already have content.` };
  }
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
  // The picture description is optional on this form; only touch it when the field was sent.
  const hasImagePrompt = formData.has("imagePrompt");
  const imagePrompt = cleanFreeText(formData.get("imagePrompt"), 500);

  const { data: item } = await supabase.from("content_items").select("locked").eq("id", id).single();
  if (item?.locked) return { error: "This item is locked and can't be edited." };

  const base = { caption, hashtags, updated_at: new Date().toISOString() };
  const { error } = hasImagePrompt
    ? await tryWithOptionalColumn(
        "image_prompt",
        () => supabase.from("content_items").update({ ...base, image_prompt: imagePrompt }).eq("id", id),
        () => supabase.from("content_items").update(base).eq("id", id)
      )
    : await supabase.from("content_items").update(base).eq("id", id);
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
  // Past tense written out: appending "d" to the verb gave "content_rejectd" / "content_skipd".
  const auditType = decision === "approve" ? "content_approved" : decision === "reject" ? "content_rejected" : "content_skipped";

  const { data: updatedItem, error } = await supabase
    .from("content_items")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { error: error.message };

  if (nextStatus === "scheduled" && updatedItem) {
    await dispatchToPublisher(supabase, updatedItem);
  }

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: auditType,
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

  if (await isEmergencyFrozen(supabase)) {
    return { error: "Uploads are paused platform-wide (Emergency Freeze) — try again once it's lifted." };
  }

  const platform = formData.get("platform") as ContentPlatform;
  const scheduledDate = formData.get("scheduledDate") as string;
  const scheduledTime = (formData.get("scheduledTime") as string) || null;
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
      scheduled_time: scheduledTime,
      caption,
      hashtags,
      status: "scheduled",
      source: "client_uploaded",
      control_mode: "approval_required",
      created_by: userId,
    })
    .select("*")
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

  await dispatchToPublisher(supabase, item);

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

  if (await isEmergencyFrozen(supabase)) {
    return { error: "Uploads are paused platform-wide (Emergency Freeze) — try again once it's lifted." };
  }

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
      // Only present once migration 0038 is in; spread so an older database never sees the column.
      ...(source.image_prompt ? { image_prompt: source.image_prompt } : {}),
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
// On-demand publish confirmation — no cron, same pattern as every other sync
// in this app. Re-checks Buffer/YouTube for items already sent, and flips
// status to 'published' (real, for the first time as of Phase 4) once
// confirmed, or records the error.
// ============================================================================
export async function checkPublishStatusAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { data: item } = await supabase.from("content_items").select("*").eq("id", id).single();
  if (!item) return { error: "Content item not found." };
  if (item.publish_status !== "sent") return { error: "Nothing to check yet — this item hasn't been sent out." };

  try {
    if ((item.platform === "facebook" || item.platform === "instagram") && item.buffer_post_id) {
      const bufferStatus = await getBufferPostStatus(item.buffer_post_id);
      if (bufferStatus.status === "sent") {
        await supabase.from("content_items").update({ status: "published" }).eq("id", id);
      } else if (bufferStatus.status === "error" || bufferStatus.error) {
        await supabase
          .from("content_items")
          .update({ publish_status: "error", publish_error: bufferStatus.error ?? "Buffer reported an error." })
          .eq("id", id);
      }
    } else if (item.platform === "youtube" && item.youtube_video_id) {
      const accessToken = await getValidAccessToken(supabase, member.orgId, "youtube");
      if (accessToken) {
        const ytStatus = await getYoutubeVideoStatus(accessToken, item.youtube_video_id);
        if (ytStatus.uploadStatus === "processed" && ytStatus.privacyStatus === "public") {
          await supabase.from("content_items").update({ status: "published" }).eq("id", id);
        } else if (ytStatus.uploadStatus === "failed" || ytStatus.uploadStatus === "rejected") {
          await supabase
            .from("content_items")
            .update({ publish_status: "error", publish_error: `YouTube upload ${ytStatus.uploadStatus}.` })
            .eq("id", id);
        }
      }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Status check failed" };
  }

  refresh();
  return {};
}

// ============================================================================
// "Send now" / "Retry" for a scheduled post that hasn't actually gone out —
// approved before a channel was linked, approved during a Master STOP, or one
// that hit a publish error. Before this existed such a post stayed at
// "not sent" forever: nothing ever tried again.
// ============================================================================
export async function sendNowAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { data: item } = await supabase.from("content_items").select("*").eq("id", id).single();
  if (!item) return { error: "Content item not found." };
  if (item.status !== "scheduled") return { error: "Approve the post first — only scheduled posts can be sent." };
  if (item.publish_status === "sent") return { error: "This post has already been sent." };

  const result = await dispatchToPublisher(supabase, item as ContentItem);
  refresh();

  switch (result.outcome) {
    case "sent":
      return {};
    case "no_channel":
      return {
        error: `No ${PLATFORM_LABELS[item.platform as ContentPlatform]} channel is linked yet. Your Digital Command contact links it from the admin panel, and your scheduled posts are then sent automatically.`,
      };
    case "not_connected":
      return { error: "Connect your YouTube channel first (SEO page, Connected Services)." };
    case "paused":
      return { error: result.message };
    case "past":
      return { error: "The scheduled time has already passed — reschedule it to a future time, then send again." };
    case "skipped":
      return { error: "Nothing to send for this post." };
    case "error":
      return { error: result.message };
  }
}

// ============================================================================
// Refresh engagement insights for every published Facebook/Instagram post in
// the window being viewed, in one click (capped, sequential — Buffer's API is
// one call per post).
// ============================================================================
export async function syncAllInsightsAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  if (!startDate || !endDate) return { error: "Missing date range." };

  const { data: items } = await supabase
    .from("content_items")
    .select("id, buffer_post_id")
    .eq("org_id", member.orgId)
    .eq("status", "published")
    .not("buffer_post_id", "is", null)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
    .limit(25);
  if (!items?.length) return { error: "No published Facebook/Instagram posts in this view yet." };

  let synced = 0;
  let lastError: string | null = null;
  for (const item of items) {
    try {
      const metrics = await getBufferPostMetrics(item.buffer_post_id as string);
      await supabase
        .from("content_items")
        .update({ insights: metrics.metrics, insights_synced_at: new Date().toISOString() })
        .eq("id", item.id);
      synced += 1;
    } catch (err) {
      if (!(err instanceof BufferApiError)) throw err;
      lastError = err.message;
    }
  }

  refresh();
  if (synced === 0 && lastError) return { error: lastError };
  return {};
}

// ============================================================================
// On-demand engagement insights for a published Facebook/Instagram post —
// same on-demand-sync discipline as checkPublishStatusAction above (no cron,
// client clicks "Refresh insights"). Only meaningful once Buffer confirms
// the post was actually sent (buffer_post_id set, publish_status='sent') —
// Buffer has nothing to report before then.
// ============================================================================
export async function syncPostInsightsAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { data: item } = await supabase.from("content_items").select("buffer_post_id, publish_status").eq("id", id).single();
  if (!item) return { error: "Content item not found." };
  if (!item.buffer_post_id || item.publish_status !== "sent") {
    return { error: "Nothing to fetch yet — this post hasn't been confirmed sent." };
  }

  let metrics;
  try {
    metrics = await getBufferPostMetrics(item.buffer_post_id);
  } catch (err) {
    if (err instanceof BufferApiError) return { error: err.message };
    throw err;
  }

  const { error } = await supabase
    .from("content_items")
    .update({ insights: metrics.metrics, insights_synced_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  refresh();
  return {};
}

// ============================================================================
// Autopilot / Approval Required mode switch (spec §10)
// ============================================================================
// ============================================================================
// Version restore (spec §24 Backup + Rollback) — content_versions has always
// been append-only history; this is the first thing that reads it back for
// display and writes an old version's caption back onto content_items.
// Restoring inserts a NEW version rather than rewriting history.
// ============================================================================
export async function restoreContentVersionAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const itemId = formData.get("itemId") as string;
  const versionNumber = Number(formData.get("versionNumber"));

  const { data: item } = await supabase.from("content_items").select("locked, publish_status").eq("id", itemId).single();
  if (!item) return { error: "Content item not found." };
  if (item.locked) return { error: "This item is locked." };
  if (item.publish_status !== "not_sent") {
    return { error: "This has already been sent out — restoring an old version here wouldn't change what's actually live." };
  }

  const { data: version } = await supabase
    .from("content_versions")
    .select("caption, hashtags")
    .eq("content_item_id", itemId)
    .eq("version_number", versionNumber)
    .single();
  if (!version) return { error: "That version could not be found." };

  await supabase
    .from("content_items")
    .update({ caption: version.caption, hashtags: version.hashtags, status: "waiting_approval", updated_at: new Date().toISOString() })
    .eq("id", itemId);

  const { data: versionRows } = await supabase
    .from("content_versions")
    .select("version_number")
    .eq("content_item_id", itemId)
    .order("version_number", { ascending: false })
    .limit(1);
  await supabase.from("content_versions").insert({
    content_item_id: itemId,
    org_id: member.orgId,
    version_number: (versionRows?.[0]?.version_number ?? 0) + 1,
    caption: version.caption,
    hashtags: version.hashtags,
    generated_by: "restored",
    restored_from_version: versionNumber,
  });

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "content_version_restored",
    target: itemId,
    newState: { restoredFromVersion: versionNumber },
  });

  refresh();
  return {};
}

// ============================================================================
// Bulk-clear the currently viewed planning window — for a client who wants to
// wipe a batch of drafted/scheduled posts and start over. Deliberately safe
// in two ways: it skips locked items (same guard as the single-item delete
// above) rather than failing the whole batch, and it never touches an item
// whose publish_status is already 'sent' — that's real publish history, not
// a draft, and deleting it here would be indistinguishable from actual data
// loss for content that may already be live on Facebook/Instagram/YouTube.
// ============================================================================
export async function clearPlannerAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  if (!startDate || !endDate) return { error: "Missing date range." };

  const { data: deleted, error } = await supabase
    .from("content_items")
    .delete()
    .eq("org_id", member.orgId)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
    .eq("locked", false)
    .neq("publish_status", "sent")
    .select("id");
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "planner_cleared",
    newState: { count: deleted?.length ?? 0, startDate, endDate },
  });

  refresh();
  return {};
}

export async function setControlModeAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const mode = formData.get("mode") as ContentControlMode;
  const approvalThenAutopilot = formData.get("approvalThenAutopilot") === "true";
  const autopilotPlatforms = formData.getAll("autopilotPlatforms") as ContentPlatform[];

  const { error } = await supabase
    .from("client_settings")
    .update({
      content_control_mode: mode,
      approval_then_autopilot: approvalThenAutopilot,
      autopilot_since: mode === "autopilot" ? istDateString() : null,
      autopilot_platforms: autopilotPlatforms,
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
    newState: { mode, approvalThenAutopilot, autopilotPlatforms },
  });

  refresh();
  return {};
}
