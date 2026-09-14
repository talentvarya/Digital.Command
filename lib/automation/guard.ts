import type { SupabaseClient } from "@supabase/supabase-js";

// Two separate checks, not one combined function. Emergency Freeze (Super
// Admin, platform-wide) and Master STOP (client, their own org only) mean
// different things — a client's own manual upload during their own Master
// STOP isn't "automation acting for them" and shouldn't be blocked by it,
// but spec §28 explicitly lists "Uploads" as something Emergency Freeze
// stops. See lib/publishing/dispatch.ts and app/app/planner/actions.ts for
// which check each call site actually needs.

export async function isEmergencyFrozen(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from("system_settings").select("emergency_freeze").single();
  return data?.emergency_freeze ?? false;
}

export async function checkAutomationAllowed(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  if (await isEmergencyFrozen(supabase)) {
    return { allowed: false, reason: "Automation is paused platform-wide (Emergency Freeze) — try again once it's lifted." };
  }

  const { data } = await supabase.from("client_settings").select("master_stop").eq("org_id", orgId).maybeSingle();
  if (data?.master_stop) {
    return { allowed: false, reason: "Automation is paused (Master STOP) — turn it off in your dashboard to continue." };
  }

  return { allowed: true };
}
