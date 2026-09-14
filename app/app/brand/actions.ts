"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadOrgFile } from "@/lib/supabase/upload";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/app/register/actions";

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export async function updateBrandProfileAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;
  const { userId, orgId } = member;

  let logoPath: string | undefined;
  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    try {
      logoPath = await uploadOrgFile(supabase, "brand-assets", orgId, logoFile);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Logo upload failed" };
    }
  }

  const { data: before } = await supabase.from("brand_profiles").select("*").eq("org_id", orgId).maybeSingle();

  const payload = {
    org_id: orgId,
    ...(logoPath ? { logo_path: logoPath } : {}),
    colors: splitList(formData.get("colors")),
    fonts: splitList(formData.get("fonts")),
    business_description: textOrNull(formData.get("business_description")),
    products_services: textOrNull(formData.get("products_services")),
    target_audience: textOrNull(formData.get("target_audience")),
    locations: textOrNull(formData.get("locations")),
    phone: textOrNull(formData.get("phone")),
    whatsapp: textOrNull(formData.get("whatsapp")),
    offers: textOrNull(formData.get("offers")),
    cta_style: textOrNull(formData.get("cta_style")),
    preferred_tone: textOrNull(formData.get("preferred_tone")),
    words_to_avoid: splitList(formData.get("words_to_avoid")),
    image_style: textOrNull(formData.get("image_style")),
    video_style: textOrNull(formData.get("video_style")),
    competitors: splitList(formData.get("competitors")),
    reference_content: textOrNull(formData.get("reference_content")),
    approved_examples: textOrNull(formData.get("approved_examples")),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("brand_profiles").upsert(payload, { onConflict: "org_id" });
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "brand_profile_updated",
    target: orgId,
    previousState: before ?? null,
    newState: payload,
  });

  revalidatePath("/app/brand");
  return {};
}
