"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import type { ActionResult } from "@/app/register/actions";

export async function markAllNotificationsReadAction(
  _prevState: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("org_id", member.orgId)
    .eq("read", false);
  if (error) return { error: error.message };

  revalidatePath("/app", "layout");
  return {};
}
