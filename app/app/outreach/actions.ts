"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { fetchPageContent, pageLinksToDomain } from "@/lib/web/fetch-page";
import { assessOpportunity } from "@/lib/ai/assess-opportunity";
import { draftOutreachMessage } from "@/lib/ai/draft-outreach";
import { searchBrandMentions, CustomSearchError } from "@/lib/google/custom-search";
import { AiGenerationError } from "@/lib/ai/client";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ActionResult } from "@/app/register/actions";
import type { BrandProfile, OpportunityType, OpportunityStatus } from "@/types/database";

function refresh() {
  revalidatePath("/app/outreach");
}

async function getBrandProfile(supabase: ReturnType<typeof createClient>, orgId: string) {
  const { data } = await supabase.from("brand_profiles").select("*").eq("org_id", orgId).maybeSingle();
  return (data as BrandProfile | null) ?? null;
}

export async function searchBrandMentionsAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const query = (formData.get("query") as string)?.trim();
  if (!query) return { error: "Enter a search term (usually your business name)." };

  let results;
  try {
    results = await searchBrandMentions(query);
  } catch (err) {
    if (err instanceof CustomSearchError) return { error: err.message };
    throw err;
  }

  const { error } = await supabase.from("brand_mention_searches").insert({
    org_id: member.orgId,
    query,
    results,
  });
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function addOpportunityAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const automation = await checkAutomationAllowed(supabase, member.orgId);
  if (!automation.allowed) return { error: automation.reason };

  let url = (formData.get("url") as string)?.trim();
  const opportunityType = (formData.get("opportunityType") as OpportunityType) || "other";
  if (!url) return { error: "Enter a URL." };
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const page = await fetchPageContent(url);
  const brand = await getBrandProfile(supabase, member.orgId);

  let assessment = null;
  if (page) {
    try {
      assessment = await assessOpportunity({ page, brandProfile: brand });
      await logAiUsage(supabase, { orgId: member.orgId, feature: "opportunity_assessment", usage: assessment.usage });
    } catch (err) {
      if (!(err instanceof AiGenerationError)) throw err;
      // Fall through — still save the opportunity even if AI assessment failed.
    }
  }

  const { data: opportunity, error } = await supabase
    .from("off_page_opportunities")
    .insert({
      org_id: member.orgId,
      url,
      opportunity_type: opportunityType,
      status: assessment ? "assessed" : "new",
      relevance_score: assessment?.relevanceScore ?? null,
      quality_notes: assessment?.qualityNotes ?? (page ? null : "Could not fetch this page — check the URL."),
      spam_risk: assessment?.spamRisk ?? null,
      contact_email: page?.mailtoEmails[0] ?? null,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (error || !opportunity) return { error: error?.message ?? "Could not save this opportunity." };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "off_page_opportunity_added",
    target: opportunity.id,
    newState: { url, opportunityType },
  });

  refresh();
  return {};
}

export async function updateOpportunityAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const status = formData.get("status") as OpportunityStatus;
  const contactEmail = ((formData.get("contactEmail") as string) || "").trim() || null;
  const contactName = ((formData.get("contactName") as string) || "").trim() || null;

  const { error } = await supabase
    .from("off_page_opportunities")
    .update({ status, contact_email: contactEmail, contact_name: contactName, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function draftOutreachAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const automation = await checkAutomationAllowed(supabase, member.orgId);
  if (!automation.allowed) return { error: automation.reason };

  const opportunityId = formData.get("opportunityId") as string;
  const isFollowUp = formData.get("isFollowUp") === "true";

  const { data: opportunity } = await supabase
    .from("off_page_opportunities")
    .select("*")
    .eq("id", opportunityId)
    .single();
  if (!opportunity) return { error: "Opportunity not found." };

  const [page, brand] = await Promise.all([
    fetchPageContent(opportunity.url),
    getBrandProfile(supabase, member.orgId),
  ]);

  let drafted;
  try {
    drafted = await draftOutreachMessage({ opportunity, page, brandProfile: brand, isFollowUp });
  } catch (err) {
    if (err instanceof AiGenerationError) return { error: err.message };
    throw err;
  }
  await logAiUsage(supabase, { orgId: member.orgId, feature: "outreach_draft", usage: drafted.usage });

  const { error } = await supabase.from("outreach_messages").insert({
    opportunity_id: opportunityId,
    org_id: member.orgId,
    subject: drafted.subject,
    body: drafted.body,
    status: "draft",
    generated_by: "ai",
  });
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function markOutreachSentAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const opportunityId = formData.get("opportunityId") as string;

  const followUpDue = new Date();
  followUpDue.setDate(followUpDue.getDate() + 7);

  const { error } = await supabase
    .from("outreach_messages")
    .update({ status: "sent", sent_at: new Date().toISOString(), follow_up_due_at: followUpDue.toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) return { error: error.message };

  const { data: opp } = await supabase.from("off_page_opportunities").select("status").eq("id", opportunityId).single();
  const nextStatus: OpportunityStatus = opp?.status === "contacted" ? "awaiting_response" : "contacted";
  await supabase
    .from("off_page_opportunities")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", opportunityId);

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "outreach_marked_sent",
    target: opportunityId,
  });

  refresh();
  return {};
}

// Real, working "earned backlink verification" / "lost backlink monitoring"
// (spec §9.2) — scoped to links Digital Command knows about because they came
// through this pipeline, not a web-wide index (see API_INTEGRATIONS.md).
export async function checkBacklinkAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { data: opportunity } = await supabase.from("off_page_opportunities").select("*").eq("id", id).single();
  if (!opportunity) return { error: "Opportunity not found." };

  const { data: websiteLink } = await supabase
    .from("org_links")
    .select("url")
    .eq("org_id", member.orgId)
    .eq("link_type", "website")
    .maybeSingle();
  if (!websiteLink?.url) return { error: "Add your website in Links first so there's something to check for." };

  const targetDomain = new URL(/^https?:\/\//i.test(websiteLink.url) ? websiteLink.url : `https://${websiteLink.url}`).hostname;

  const page = await fetchPageContent(opportunity.url);
  if (!page) {
    await supabase
      .from("off_page_opportunities")
      .update({ link_verified: false, link_last_checked_at: new Date().toISOString() })
      .eq("id", id);
    return { error: "Could not fetch that page to check for the link." };
  }

  const found = pageLinksToDomain(page.html, opportunity.url, targetDomain);
  const wasVerifiedBefore = opportunity.link_verified;

  await supabase
    .from("off_page_opportunities")
    .update({
      link_verified: found,
      link_last_checked_at: new Date().toISOString(),
      link_first_confirmed_at: found && !opportunity.link_first_confirmed_at ? new Date().toISOString() : opportunity.link_first_confirmed_at,
      status: found ? "link_acquired" : wasVerifiedBefore ? "lost" : opportunity.status,
    })
    .eq("id", id);

  refresh();
  return {};
}
