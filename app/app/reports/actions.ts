"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { countIssues, generateReportNarrative, type ReportMetricsInput } from "@/lib/ai/generate-report";
import { AiGenerationError } from "@/lib/ai/client";
import { logAiUsage } from "@/lib/ai/log-usage";
import { addDays, istDateString } from "@/lib/utils/ist";
import type { ActionResult } from "@/app/register/actions";

export async function generateReportAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;
  const { userId, orgId } = member;

  const periodDays = Number(formData.get("periodDays")) || 14;
  // Counted back from today in India (the server's own date is still yesterday's until 5:30 AM IST).
  const periodEndStr = istDateString();
  const periodStartStr = addDays(periodEndStr, -periodDays);

  const [{ data: audits }, { data: scSnapshots }, { data: gaSnapshots }, { data: content }] = await Promise.all([
    supabase.from("seo_audits").select("score, issues, crawled_at").eq("org_id", orgId).order("crawled_at", { ascending: false }).limit(2),
    supabase
      .from("search_console_snapshots")
      .select("total_clicks, total_impressions, avg_position, avg_ctr, synced_at")
      .eq("org_id", orgId)
      .order("synced_at", { ascending: false })
      .limit(2),
    supabase
      .from("analytics_snapshots")
      .select("sessions, users, conversions, synced_at")
      .eq("org_id", orgId)
      .order("synced_at", { ascending: false })
      .limit(2),
    supabase
      .from("content_items")
      .select("status")
      .eq("org_id", orgId)
      .gte("scheduled_date", periodStartStr)
      .lte("scheduled_date", periodEndStr),
  ]);

  const input: ReportMetricsInput = {
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    seoAudit: audits?.[0]
      ? { score: audits[0].score, issueCount: countIssues(audits[0].issues), previousScore: audits[1]?.score ?? null }
      : null,
    searchConsole: scSnapshots?.[0]
      ? {
          clicks: scSnapshots[0].total_clicks,
          impressions: scSnapshots[0].total_impressions,
          avgPosition: scSnapshots[0].avg_position,
          avgCtr: scSnapshots[0].avg_ctr,
          previousClicks: scSnapshots[1]?.total_clicks ?? null,
          previousAvgPosition: scSnapshots[1]?.avg_position ?? null,
        }
      : null,
    analytics: gaSnapshots?.[0]
      ? {
          sessions: gaSnapshots[0].sessions,
          users: gaSnapshots[0].users,
          conversions: gaSnapshots[0].conversions,
          previousSessions: gaSnapshots[1]?.sessions ?? null,
        }
      : null,
    content: {
      totalCount: content?.length ?? 0,
      scheduledCount: (content ?? []).filter((c) => c.status === "scheduled").length,
      publishedCount: (content ?? []).filter((c) => c.status === "published").length,
    },
  };

  let narrative;
  try {
    narrative = await generateReportNarrative(input);
  } catch (err) {
    if (err instanceof AiGenerationError) return { error: err.message };
    throw err;
  }
  await logAiUsage(supabase, { orgId, feature: "report_narrative", usage: narrative.usage });

  const { error } = await supabase.from("reports").insert({
    org_id: orgId,
    period_start: periodStartStr,
    period_end: periodEndStr,
    generated_by: userId,
    metrics_snapshot: input,
    summary_text: narrative.summary,
    next_plan_text: narrative.nextPlan,
  });
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "report_generated",
    target: orgId,
    newState: { periodStart: periodStartStr, periodEnd: periodEndStr },
  });

  revalidatePath("/app/reports");
  return {};
}
