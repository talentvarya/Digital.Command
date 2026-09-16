"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { draftReviewReply } from "@/lib/ai/draft-review-reply";
import { AiGenerationError } from "@/lib/ai/client";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ActionResult } from "@/app/register/actions";
import type { BrandProfile, ReviewPlatform, ReviewRequestChannel } from "@/types/database";

function refresh() {
  revalidatePath("/app/reputation");
}

// ============================================================================
// Client's own Google/Facebook review page URLs — real automated posting
// needs Google Business Profile API access (60+ day verified profile, formal
// request, rejections common — same gate that's blocked Local SEO/GBP since
// Phase 4). These links are what request messages point customers at, and
// what the client posts AI-drafted replies onto by hand.
// ============================================================================
export async function saveReviewLinksAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const googleReviewLink = ((formData.get("googleReviewLink") as string) || "").trim() || null;
  const facebookReviewLink = ((formData.get("facebookReviewLink") as string) || "").trim() || null;

  const { error } = await supabase
    .from("client_settings")
    .update({ google_review_link: googleReviewLink, facebook_review_link: facebookReviewLink })
    .eq("org_id", member.orgId);
  if (error) return { error: error.message };

  refresh();
  return {};
}

// ============================================================================
// Logs a review request the client is about to send through their own
// WhatsApp/SMS/email — the message itself is composed client-side (see
// SendReviewRequestForm) and passed in as `messageSent` so this action stays
// a pure log, same as outreach's "mark sent" not sending anything itself.
// ============================================================================
export async function createReviewRequestAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const contactName = ((formData.get("contactName") as string) || "").trim();
  const contactPhone = ((formData.get("contactPhone") as string) || "").trim() || null;
  const contactEmail = ((formData.get("contactEmail") as string) || "").trim() || null;
  const channel = (formData.get("channel") as ReviewRequestChannel) || "whatsapp";
  const messageSent = ((formData.get("messageSent") as string) || "").trim();

  if (!contactName) return { error: "Enter the customer's name." };
  if (!messageSent) return { error: "Add your Google or Facebook review link below first." };

  const { error } = await supabase.from("review_requests").insert({
    org_id: member.orgId,
    contact_name: contactName,
    contact_phone: contactPhone,
    contact_email: contactEmail,
    channel,
    message_sent: messageSent,
    created_by: member.userId,
  });
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "review_request_logged",
    newState: { contactName, channel },
  });

  refresh();
  return {};
}

// ============================================================================
// Client logs a review they received by hand — no live Google/Facebook feed
// without GBP API access, so this is the only way a review enters the system
// for now (spec-equivalent: same manual-entry discipline as everything else
// gated on that external approval).
// ============================================================================
export async function logReviewAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const platform = (formData.get("platform") as ReviewPlatform) || "google";
  const reviewerName = ((formData.get("reviewerName") as string) || "").trim() || null;
  const ratingRaw = formData.get("rating") as string;
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const reviewText = ((formData.get("reviewText") as string) || "").trim() || null;
  const reviewDate = (formData.get("reviewDate") as string) || null;

  if (!rating && !reviewText) return { error: "Add at least a rating or the review text." };

  const { error } = await supabase.from("reviews").insert({
    org_id: member.orgId,
    platform,
    reviewer_name: reviewerName,
    rating,
    review_text: reviewText,
    review_date: reviewDate || null,
    created_by: member.userId,
  });
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function draftReviewReplyAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const automation = await checkAutomationAllowed(supabase, member.orgId);
  if (!automation.allowed) return { error: automation.reason };

  const reviewId = formData.get("reviewId") as string;
  const { data: review } = await supabase.from("reviews").select("*").eq("id", reviewId).single();
  if (!review) return { error: "Review not found." };

  const { data: brand } = await supabase.from("brand_profiles").select("*").eq("org_id", member.orgId).maybeSingle();

  let drafted;
  try {
    drafted = await draftReviewReply({ review, brandProfile: (brand as BrandProfile | null) ?? null });
  } catch (err) {
    if (err instanceof AiGenerationError) return { error: err.message };
    throw err;
  }
  await logAiUsage(supabase, { orgId: member.orgId, feature: "review_reply_draft", usage: drafted.usage });

  const { error } = await supabase
    .from("reviews")
    .update({ ai_reply_draft: drafted.reply, reply_status: "drafted", updated_at: new Date().toISOString() })
    .eq("id", reviewId);
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function markReplyPostedAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const reviewId = formData.get("reviewId") as string;

  const { error } = await supabase
    .from("reviews")
    .update({ reply_status: "posted", replied_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", reviewId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "review_reply_posted",
    target: reviewId,
  });

  refresh();
  return {};
}
