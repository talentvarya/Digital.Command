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
import { ApifyError } from "@/lib/apify/client";
import { requirePremiumApify, getConnectedApifyToken } from "@/lib/apify/access";
import { runAiModeCheck, MAX_AI_CHECK_QUERIES } from "@/lib/apify/ai-visibility";
import { analyzeAnswer, brandNameVariants } from "@/lib/aeo/mentions";
import type { ActionResult } from "@/app/register/actions";
import type { BrandProfile } from "@/types/database";

function refresh() {
  revalidatePath("/app/ai-visibility");
}

// Asks Google's AI Mode the client's own customer-style questions and records
// whether the business is named, its website is cited, and which competitors
// are named instead. Runs on the client's OWN Apify account (premium add-on),
// costs real money there, and only ever runs when the client submits the form.
export async function runAiVisibilityCheckAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const gate = await requirePremiumApify(supabase, member.orgId);
  if (gate) return gate;

  const automation = await checkAutomationAllowed(supabase, member.orgId);
  if (!automation.allowed) return { error: automation.reason };

  const queries = [
    ...new Set(
      String(formData.get("queries") ?? "")
        .split("\n")
        .map((q) => q.trim())
        .filter(Boolean)
    ),
  ];
  if (queries.length === 0) return { error: "Enter at least one question a customer might ask." };
  if (queries.length > MAX_AI_CHECK_QUERIES) {
    return { error: `Up to ${MAX_AI_CHECK_QUERIES} questions per check — each one costs credits on your Apify account.` };
  }
  if (queries.some((q) => q.length > 200)) return { error: "Keep each question under 200 characters." };

  const token = await getConnectedApifyToken(supabase, member.orgId);
  if (!token) return { error: "Connect your Apify account first (on the Competitor Search page)." };

  const [{ data: org }, { data: brand }, { data: websiteLink }] = await Promise.all([
    supabase.from("organizations").select("legal_name").eq("id", member.orgId).single(),
    supabase.from("brand_profiles").select("competitors").eq("org_id", member.orgId).maybeSingle(),
    supabase.from("org_links").select("url").eq("org_id", member.orgId).eq("link_type", "website").maybeSingle(),
  ]);

  let domain: string | null = null;
  try {
    domain = websiteLink?.url ? new URL(websiteLink.url).hostname.replace(/^www\./, "") : null;
  } catch {
    domain = null;
  }
  const identity = {
    names: brandNameVariants(org?.legal_name ?? ""),
    domain,
    competitors: (brand?.competitors as string[] | null) ?? [],
  };

  let answers;
  try {
    answers = await runAiModeCheck({ apiToken: token, queries });
  } catch (err) {
    if (err instanceof ApifyError) {
      await supabase.from("apify_connections").update({ status: "error", updated_at: new Date().toISOString() }).eq("org_id", member.orgId);
      return { error: err.message };
    }
    throw err;
  }

  const rows = answers.map((a) => {
    const analysis = analyzeAnswer({ text: a.text, sources: a.sources }, identity);
    return {
      org_id: member.orgId,
      query: a.query,
      engine: "google_ai_mode",
      answered: a.answered,
      brand_mentioned: analysis.mentioned,
      brand_cited: analysis.cited,
      competitors_mentioned: analysis.competitorsMentioned,
      excerpt: analysis.excerpt,
      sources: a.sources,
      raw: a.raw,
      triggered_by: member.userId,
    };
  });
  const { error } = await supabase.from("ai_visibility_checks").insert(rows);
  if (error) return { error: error.message };

  await supabase.from("apify_connections").update({ last_used_at: new Date().toISOString() }).eq("org_id", member.orgId);

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "ai_visibility_check_run",
    newState: { queries: queries.length, mentioned: rows.filter((r) => r.brand_mentioned).length },
  });

  refresh();
  return {};
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
