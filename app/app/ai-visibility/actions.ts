"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { runAeoAudit } from "@/lib/aeo/audit";
import { draftAeoFaq } from "@/lib/ai/draft-aeo-faq";
import { AiGenerationError } from "@/lib/ai/client";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ActionResult } from "@/app/register/actions";
import type { BrandProfile } from "@/types/database";

function refresh() {
  revalidatePath("/app/ai-visibility");
}

export async function runAeoAuditAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
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
    result = await runAeoAudit(url);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Audit failed" };
  }

  const { error } = await supabase.from("aeo_audits").insert({
    org_id: member.orgId,
    url,
    score: result.score,
    findings: result.findings,
    triggered_by: member.userId,
  });
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "aeo_audit_run",
    target: url,
    newState: { score: result.score, findingCount: result.findings.length },
  });

  refresh();
  return {};
}

export async function draftFaqAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const automation = await checkAutomationAllowed(supabase, member.orgId);
  if (!automation.allowed) return { error: automation.reason };

  const auditId = formData.get("auditId") as string;
  const [{ data: audit }, { data: org }, { data: brand }] = await Promise.all([
    supabase.from("aeo_audits").select("*").eq("id", auditId).single(),
    supabase.from("organizations").select("legal_name").eq("id", member.orgId).single(),
    supabase.from("brand_profiles").select("*").eq("org_id", member.orgId).maybeSingle(),
  ]);
  if (!audit) return { error: "Audit not found." };

  let drafted;
  try {
    drafted = await draftAeoFaq({
      findings: audit.findings,
      brandProfile: (brand as BrandProfile | null) ?? null,
      businessName: org?.legal_name ?? "the business",
      url: audit.url,
    });
  } catch (err) {
    if (err instanceof AiGenerationError) return { error: err.message };
    throw err;
  }
  await logAiUsage(supabase, { orgId: member.orgId, feature: "aeo_faq_draft", usage: drafted.usage });

  const { error } = await supabase.from("aeo_audits").update({ faq_draft: drafted.faqDraft }).eq("id", auditId);
  if (error) return { error: error.message };

  refresh();
  return {};
}
