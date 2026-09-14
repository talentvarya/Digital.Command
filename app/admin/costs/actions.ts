"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import type { ActionResult } from "@/app/register/actions";

// Buffer/storage/other cost have no API to pull from (Buffer is a flat VMG
// subscription, not billed per client; Supabase storage cost needs a
// separate Management API credential this app doesn't have) — same
// go-manual-and-label-it precedent as Phase 1's payment verification,
// rather than fabricating a number. AI cost is the one real, automatic
// figure (lib/ai/log-usage.ts).
export async function updateManualCostsAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const orgId = formData.get("orgId") as string;

  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const bufferCost = formData.get("bufferCost") as string;
  const storageCost = formData.get("storageCost") as string;
  const otherCost = formData.get("otherCost") as string;
  const otherLabel = ((formData.get("otherLabel") as string) || "").trim() || null;

  const { error } = await supabase
    .from("client_settings")
    .update({
      manual_buffer_cost_usd: bufferCost ? Number(bufferCost) : null,
      manual_storage_cost_usd: storageCost ? Number(storageCost) : null,
      manual_other_cost_usd: otherCost ? Number(otherCost) : null,
      manual_other_cost_label: otherLabel,
    })
    .eq("org_id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/admin/costs");
  return {};
}
