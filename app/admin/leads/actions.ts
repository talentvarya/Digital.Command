"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import type { ActionResult } from "@/app/register/actions";
import type { LeadStatus } from "@/types/database";

function refresh() {
  revalidatePath("/admin/leads");
}

export async function updateLeadStatusAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const id = formData.get("id") as string;
  const status = formData.get("status") as LeadStatus;
  const notes = ((formData.get("notes") as string) || "").trim() || null;

  const { error } = await supabase
    .from("roadmap_leads")
    .update({ status, notes, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  refresh();
  return {};
}
