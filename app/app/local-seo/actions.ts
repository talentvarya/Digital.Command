"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { draftGbpPost } from "@/lib/ai/draft-gbp-post";
import { AiGenerationError } from "@/lib/ai/client";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ActionResult } from "@/app/register/actions";
import type { BrandProfile, LocalSeoProfile } from "@/types/database";

function refresh() {
  revalidatePath("/app/local-seo");
}

export async function saveLocalSeoProfileAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const address = ((formData.get("address") as string) || "").trim() || null;
  const city = ((formData.get("city") as string) || "").trim() || null;
  const state = ((formData.get("state") as string) || "").trim() || null;
  const pincode = ((formData.get("pincode") as string) || "").trim() || null;
  const gbpCategory = ((formData.get("gbpCategory") as string) || "").trim() || null;
  const gbpUrl = ((formData.get("gbpUrl") as string) || "").trim() || null;

  const { error } = await supabase.from("local_seo_profiles").upsert({
    org_id: member.orgId,
    address,
    city,
    state,
    pincode,
    gbp_category: gbpCategory,
    gbp_url: gbpUrl,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function toggleCitationAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const directory = (formData.get("directory") as string) || "";
  if (!directory) return { error: "Missing directory name." };

  const { data: existing } = await supabase
    .from("local_seo_profiles")
    .select("citations_completed")
    .eq("org_id", member.orgId)
    .maybeSingle();

  const current: string[] = (existing?.citations_completed as string[] | undefined) ?? [];
  const next = current.includes(directory) ? current.filter((d) => d !== directory) : [...current, directory];

  const { error } = await supabase
    .from("local_seo_profiles")
    .upsert({ org_id: member.orgId, citations_completed: next, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function draftGbpPostAction(_prevState: ActionResult, _formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const automation = await checkAutomationAllowed(supabase, member.orgId);
  if (!automation.allowed) return { error: automation.reason };

  const [{ data: org }, { data: brand }, { data: localProfile }] = await Promise.all([
    supabase.from("organizations").select("legal_name").eq("id", member.orgId).single(),
    supabase.from("brand_profiles").select("*").eq("org_id", member.orgId).maybeSingle(),
    supabase.from("local_seo_profiles").select("*").eq("org_id", member.orgId).maybeSingle(),
  ]);

  let drafted;
  try {
    drafted = await draftGbpPost({
      brandProfile: (brand as BrandProfile | null) ?? null,
      localSeoProfile: (localProfile as LocalSeoProfile | null) ?? null,
      businessName: org?.legal_name ?? "the business",
    });
  } catch (err) {
    if (err instanceof AiGenerationError) return { error: err.message };
    throw err;
  }
  await logAiUsage(supabase, { orgId: member.orgId, feature: "local_seo_post_draft", usage: drafted.usage });

  const { error } = await supabase.from("local_seo_posts").insert({
    org_id: member.orgId,
    post_text: drafted.postText,
    keyword_suggestions: drafted.keywordSuggestions,
    created_by: member.userId,
  });
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function markGbpPostPostedAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const postId = formData.get("postId") as string;

  const { error } = await supabase
    .from("local_seo_posts")
    .update({ status: "posted", posted_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "local_seo_post_posted",
    target: postId,
  });

  refresh();
  return {};
}
