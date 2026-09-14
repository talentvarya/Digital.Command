"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/app/register/actions";

// Spec §28 Admin Emergency Freeze — platform-wide, stops Publishing/Website
// edits/Outreach/Uploads/AI jobs across every org (see lib/automation/guard.ts),
// while Login/Reports/Audit logs/Admin investigation stay available. Distinct
// from a client's own Master STOP (app/app/dashboard/actions.ts) — this is
// the one Super Admin-only, cross-tenant control in the whole app.
export async function setEmergencyFreezeAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const freeze = formData.get("freeze") === "true";
  const reason = (formData.get("reason") as string)?.trim();
  if (freeze && !reason) return { error: "A reason is required to engage Emergency Freeze." };

  const { error } = await supabase
    .from("system_settings")
    .update({
      emergency_freeze: freeze,
      frozen_by: freeze ? admin.id : null,
      frozen_at: freeze ? new Date().toISOString() : null,
      frozen_reason: freeze ? reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: freeze ? "emergency_freeze_engaged" : "emergency_freeze_lifted",
    target: "platform",
    newState: freeze ? { reason } : null,
  });

  revalidatePath("/admin/dashboard");
  return {};
}
