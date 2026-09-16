import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateOneSlot, getBrandAndSettings } from "@/app/app/planner/actions";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { TIME_SLOTS, MONTHLY_AI_GENERATION_SAFETY_CAP } from "@/lib/constants/content";
import type { ContentControlMode, ContentPlatform } from "@/types/database";

// Runs once a day (see vercel.json) and keeps every Autopilot org's planner
// filled exactly 2 days ahead — never the whole window at once. Generating
// a handful of items a day instead of dozens in one burst is what actually
// keeps this under Unsplash's 50-requests/hour demo limit (see
// lib/unsplash/client.ts) and spreads AI spend evenly instead of spiking it.
//
// The "Fill this week/window now" button (runAutopilotFillAction) is still
// there for an on-demand catch-up — this cron is the steady background
// drip, not a replacement for it.
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

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 2);
  const dateStr = targetDate.toISOString().slice(0, 10);

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
    if ((generationsThisMonth ?? 0) >= MONTHLY_AI_GENERATION_SAFETY_CAP) {
      results.push({ orgId, skipped: "monthly cap reached" });
      continue;
    }

    const { data: existing } = await supabase
      .from("content_items")
      .select("platform, scheduled_time")
      .eq("org_id", orgId)
      .eq("scheduled_date", dateStr);
    const filled = new Set((existing ?? []).map((i) => `${i.platform}:${i.scheduled_time ?? TIME_SLOTS[0].value}`));

    const { brand } = await getBrandAndSettings(supabase, orgId);
    const controlMode = settings.content_control_mode as ContentControlMode;

    let created = 0;
    for (const platform of platforms) {
      for (const slot of TIME_SLOTS) {
        if (filled.has(`${platform}:${slot.value}`)) continue;
        const result = await generateOneSlot(supabase, {
          orgId,
          userId: owner.user_id as string,
          platform,
          scheduledDate: dateStr,
          controlMode,
          brand,
          scheduledTime: slot.value,
          auditSource: "AUTOPILOT",
        });
        if (!("error" in result)) created += 1;
      }
    }
    results.push({ orgId, date: dateStr, created });
  }

  return NextResponse.json({ date: dateStr, orgs: results });
}
