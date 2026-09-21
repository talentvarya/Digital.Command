import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { fillAutopilotBuffer, getBrandAndSettings } from "@/app/app/planner/actions";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { recordCronRun } from "@/lib/admin/cron-log";
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
//
// Every run is recorded in cron_runs (shown on the admin Config Health page).
// A run counts as failed if it throws, or if any org generated nothing AND hit
// an error (e.g. the AI key is missing) — previously that case reported
// success with created: 0, which is exactly how this job could be broken for
// days without anyone noticing.
const JOB = "planner-fill";

async function fillAllAutopilotOrgs(supabase: SupabaseClient) {
  const { data: systemSettings } = await supabase.from("system_settings").select("emergency_freeze").single();
  if (systemSettings?.emergency_freeze) {
    return { body: { skipped: "emergency_freeze" }, failedOrgs: 0, firstError: null as string | null };
  }

  const { data: autopilotSettings } = await supabase
    .from("client_settings")
    .select("org_id, content_control_mode, autopilot_platforms, master_stop")
    .eq("content_control_mode", "autopilot")
    .eq("master_stop", false);

  const results: Record<string, unknown>[] = [];
  let failedOrgs = 0;
  let firstError: string | null = null;

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

    const { created, bufferDays, lastError } = await fillAutopilotBuffer(supabase, {
      orgId,
      userId: owner.user_id as string,
      platforms,
      controlMode,
      brand,
      remainingCap: remaining,
      auditSource: "AUTOPILOT",
      force: false,
    });
    results.push({ orgId, bufferDaysBeforeRefill: bufferDays, created, error: lastError });
    if (lastError && created === 0) {
      failedOrgs += 1;
      firstError ??= lastError;
    }
  }

  return {
    body: { date: new Date().toISOString().slice(0, 10), orgs: results },
    failedOrgs,
    firstError,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    const { body, failedOrgs, firstError } = await fillAllAutopilotOrgs(supabase);
    const ok = failedOrgs === 0;
    await recordCronRun(supabase, JOB, {
      ok,
      summary: body,
      error: ok ? null : `${failedOrgs} org(s) generated nothing because of an error: ${firstError}`,
    });
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordCronRun(supabase, JOB, { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
