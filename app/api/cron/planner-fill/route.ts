import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fillAutopilotBuffer, getBrandAndSettings } from "@/app/app/planner/actions";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { MONTHLY_AI_GENERATION_SAFETY_CAP } from "@/lib/constants/content";
import type { ContentControlMode, ContentPlatform } from "@/types/database";

// Runs once a day (see vercel.json) and keeps every Autopilot org's rolling
// content buffer topped up — see fillAutopilotBuffer in
// app/app/planner/actions.ts for the actual "only refill once the buffer has
// shrunk to 2 days left, and never generate more than 7 days ahead" logic.
// Generating a handful of items a day instead of dozens in one burst is what
// actually keeps this under Unsplash's 50-requests/hour demo limit (see
// lib/unsplash/client.ts) and spreads AI spend evenly instead of spiking it.
//
// The "Fill next 7 days now" button (runAutopilotFillAction) is still there
// for an on-demand top-up of the same buffer — this cron is the steady
// background drip that keeps it from ever running dry.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: systemSettings } = await supabase.from("system_settings").select("emergency_freeze").single();
  if (systemSettings?.emergency_freeze) {
    return NextResponse.json({ skipped: "emergency_freeze" });
  }

  const { data: autopilotSettings } = await supabase
    .from("client_settings")
    .select("org_id, content_control_mode, autopilot_platforms, master_stop")
    .eq("content_control_mode", "autopilot")
    .eq("master_stop", false);

  const results: Record<string, unknown>[] = [];

  for (const settings of autopilotSettings ?? []) {
    const orgId = settings.org_id as string;
    const platforms = (settings.autopilot_platforms as ContentPlatform[] | null) ?? [];
    if (platforms.length === 0) continue;

    const automation = await checkAutomationAllowed(supabase, orgId);
    if (!automation.allowed) {
      results.push({ orgId, skipped: automation.reason });
      continue;
    }

    const { data: owner } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("member_role", "owner")
      .limit(1)
      .maybeSingle();
    if (!owner) {
      results.push({ orgId, skipped: "no owner found" });
      continue;
    }

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
      results.push({ orgId, skipped: "monthly cap reached" });
      continue;
    }

    const { brand } = await getBrandAndSettings(supabase, orgId);
    const controlMode = settings.content_control_mode as ContentControlMode;

    const { created, bufferDays } = await fillAutopilotBuffer(supabase, {
      orgId,
      userId: owner.user_id as string,
      platforms,
      controlMode,
      brand,
      remainingCap: remaining,
      auditSource: "AUTOPILOT",
      force: false,
    });
    results.push({ orgId, bufferDaysBeforeRefill: bufferDays, created });
  }

  return NextResponse.json({ date: new Date().toISOString().slice(0, 10), orgs: results });
}
