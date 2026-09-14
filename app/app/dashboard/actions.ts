"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/app/register/actions";

// Spec §28 Client Master STOP — pauses organic automation (SEO/Social/
// YouTube/Content/Outreach, via lib/automation/guard.ts's checkAutomationAllowed)
// without deleting any data. Relies on the client_settings_owner_update RLS
// policy added in 0017_phase7_rls.sql — before that fix this table had no
// org-member UPDATE policy at all, so this (and setControlModeAction) would
// have silently updated zero rows.
export async function setMasterStopAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const masterStop = formData.get("masterStop") === "true";

  const { error } = await supabase
    .from("client_settings")
    .update({ master_stop: masterStop })
    .eq("org_id", member.orgId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: masterStop ? "master_stop_engaged" : "master_stop_lifted",
    target: member.orgId,
    newState: { masterStop },
  });

  revalidatePath("/app/dashboard");
  return {};
}
