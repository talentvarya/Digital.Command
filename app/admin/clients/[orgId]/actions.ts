"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAudit } from "@/lib/audit/log";
import { revokeGoogleToken } from "@/lib/google/oauth";
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

  await supabase.from("notifications").insert({
    org_id: orgId,
    type: "account_activated",
    title: "Your account is now active",
    body: "A Super Admin approved your registration. Set up your Brand Brain and start your 7-Day Planner.",
  });

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

// ============================================================================
// Offboarding (spec §29) — revoke + disconnect + export + mark closed only,
// no data deletion. The spec names no retention period, and guessing one
// would be a real legal-shaped risk, not just a bug — explicit user
// decision to stop here (see PROJECT_PLAN.md's Phase 7 section).
// ============================================================================
export async function offboardOrgAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const orgId = formData.get("orgId") as string;
  if (formData.get("confirm") !== "true") return { error: "Please confirm before offboarding." };

  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const { data: org } = await supabase.from("organizations").select("status").eq("id", orgId).single();
  if (!org) return { error: "Client not found." };
  if (org.status === "offboarded") return { error: "This client has already been offboarded." };

  const { data: connections } = await supabase
    .from("google_connections")
    .select("id, access_token, refresh_token")
    .eq("org_id", orgId);
  let revokeFailures = 0;
  for (const conn of connections ?? []) {
    const token = conn.refresh_token || conn.access_token;
    if (token) {
      try {
        await revokeGoogleToken(token);
      } catch {
        revokeFailures++;
      }
    }
    await supabase.from("google_connections").delete().eq("id", conn.id);
  }

  const { data: bufferLinks } = await supabase.from("buffer_channel_links").select("id").eq("org_id", orgId);
  if (bufferLinks?.length) {
    await supabase.from("buffer_channel_links").delete().eq("org_id", orgId);
  }

  // Only content that was never actually sent can be safely cancelled here —
  // anything already dispatched to Buffer/YouTube can't be recalled by this
  // app (neither has an API for that), so changing our own status on it
  // would misrepresent what's actually still going out.
  const { data: skippedItems } = await supabase
    .from("content_items")
    .update({ status: "skipped", updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("publish_status", "not_sent")
    .not("status", "in", "(published,skipped,rejected)")
    .select("id");

  const { error } = await supabase.from("organizations").update({ status: "offboarded" }).eq("id", orgId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: "org_offboarded",
    target: orgId,
    newState: {
      googleConnectionsRevoked: connections?.length ?? 0,
      googleRevokeFailures: revokeFailures,
      bufferLinksRemoved: bufferLinks?.length ?? 0,
      contentItemsSkipped: skippedItems?.length ?? 0,
    },
  });

  refresh(orgId);
  return {};
}

// Spec §31 Sandbox/Test Client — a plain visibility marker, not a parallel
// system. New automation/features should be tried on a marked-sandbox org
// before real clients (an operational discipline this flag makes visible,
// not something the app enforces structurally).
export async function setSandboxAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const orgId = formData.get("orgId") as string;
  const isSandbox = formData.get("isSandbox") === "true";

  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const { error } = await supabase.from("organizations").update({ is_sandbox: isSandbox }).eq("id", orgId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: isSandbox ? "org_marked_sandbox" : "org_unmarked_sandbox",
    target: orgId,
  });

  refresh(orgId);
  return {};
}

// Premium add-on gate for Competitor Search (Apify) — off by default, a
// Super Admin switches it on per client (same manual-approval pattern as
// Phase 1's payment verification, not a live billing/plan-tier system).
export async function setPremiumApifyAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const orgId = formData.get("orgId") as string;
  const enabled = formData.get("enabled") === "true";

  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const { error } = await supabase.from("client_settings").update({ premium_apify_enabled: enabled }).eq("org_id", orgId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: enabled ? "premium_apify_enabled" : "premium_apify_disabled",
    target: orgId,
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
