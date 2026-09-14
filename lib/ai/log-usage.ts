import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateAiCostUsd } from "@/lib/constants/ai-pricing";
import type { AiProvider, AiUsageFeature } from "@/types/database";

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  provider: AiProvider;
}

// Mirrors logAudit's own shape — swallow/console-log failures, never let a
// cost-logging miss fail the real action it's attached to. Feeds the Cost/
// Profit Dashboard (spec §30); deliberately not client-readable (see
// SECURITY_AND_RLS.md — ai_usage_events RLS).
export async function logAiUsage(
  supabase: SupabaseClient,
  params: { orgId: string; feature: AiUsageFeature; usage: AiUsage }
) {
  const { error } = await supabase.from("ai_usage_events").insert({
    org_id: params.orgId,
    feature: params.feature,
    provider: params.usage.provider,
    input_tokens: params.usage.inputTokens,
    output_tokens: params.usage.outputTokens,
    estimated_cost_usd: estimateAiCostUsd(params.usage.provider, params.usage.inputTokens, params.usage.outputTokens),
  });

  if (error) {
    console.error("ai usage log insert failed", error);
  }
}
