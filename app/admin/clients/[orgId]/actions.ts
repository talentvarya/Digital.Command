"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/app/register/actions";

function refresh(orgId: string) {
  revalidatePath(`/admin/clients/${orgId}`);
  revalidatePath("/admin/dashboard");
}

export async function reviewVerificationAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const verificationId = formData.get("verificationId") as string;
  const orgId = formData.get("orgId") as string;
  const decision = formData.get("decision") as "approved" | "rejected" | "more_documents_required";
  const reason = ((formData.get("reason") as string | null) ?? "").trim();

  if (decision !== "approved" && !reason) {
    return { error: "A reason is required to reject or request more documents." };
  }

  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const { data: before } = await supabase
    .from("business_verifications")
    .select("status")
    .eq("id", verificationId)
    .single();

  const { error } = await supabase
    .from("business_verifications")
    .update({
      status: decision,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      reason: reason || null,
    })
    .eq("id", verificationId);

  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: "verification_reviewed",
    target: verificationId,
    previousState: before ?? null,
    newState: { status: decision, reason: reason || null },
  });

  refresh(orgId);
  return {};
}

export async function reviewPaymentAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const paymentId = formData.get("paymentId") as string;
  const orgId = formData.get("orgId") as string;
  const decision = formData.get("decision") as "verified" | "rejected";
  const reason = ((formData.get("reason") as string | null) ?? "").trim();

  if (decision === "rejected" && !reason) {
    return { error: "A reason is required to reject a payment." };
  }

  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const { data: before } = await supabase.from("payments").select("status").eq("id", paymentId).single();

  const { error } = await supabase
    .from("payments")
    .update({
      status: decision,
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
      reason: reason || null,
    })
    .eq("id", paymentId);

  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: "payment_reviewed",
    target: paymentId,
    previousState: before ?? null,
    newState: { status: decision, reason: reason || null },
  });

  refresh(orgId);
  return {};
}

export async function activateOrgAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const orgId = formData.get("orgId") as string;

  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const [{ data: verification }, { data: payment }, { data: org }] = await Promise.all([
    supabase.from("business_verifications").select("status").eq("org_id", orgId).single(),
    supabase.from("payments").select("status").eq("org_id", orgId).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("organizations").select("status").eq("id", orgId).single(),
  ]);

  if (verification?.status !== "approved") {
    return { error: "Verification must be approved before activation." };
  }
  if (payment?.status !== "verified") {
    return { error: "Payment must be verified before activation." };
  }
  if (org?.status !== "pending_approval") {
    return { error: `Client cannot be activated from status "${org?.status}".` };
  }

  const { error } = await supabase.from("organizations").update({ status: "active" }).eq("id", orgId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: "client_activated",
    target: orgId,
    previousState: { status: "pending_approval" },
    newState: { status: "active" },
  });

  refresh(orgId);
  return {};
}

export async function rejectApplicationAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const orgId = formData.get("orgId") as string;
  const reason = ((formData.get("reason") as string | null) ?? "").trim();
  if (!reason) return { error: "A reason is required to reject an application." };

  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const { data: before } = await supabase.from("organizations").select("status").eq("id", orgId).single();

  const { error } = await supabase.from("organizations").update({ status: "rejected" }).eq("id", orgId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: "application_rejected",
    target: orgId,
    previousState: before ?? null,
    newState: { status: "rejected", reason },
  });

  refresh(orgId);
  return {};
}
