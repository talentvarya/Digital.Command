"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadOrgFile } from "@/lib/supabase/upload";
import { logAudit } from "@/lib/audit/log";
import { accountSchema, detailsSchema } from "@/lib/validation/registration";
import { BUSINESS_TYPE_REQUIREMENTS } from "@/lib/constants/business";
import { REQUIRED_POLICY_TYPES } from "@/lib/constants/policies";
import { getPostLoginRedirect } from "@/lib/auth/redirect";
import { getRequestMeta } from "@/lib/utils/request-meta";
import type { BusinessType } from "@/types/database";

export interface ActionResult {
  error?: string;
}

export async function signUpAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = accountSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { fullName, email, password } = parsed.data;
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?next=/login`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await logAudit(supabase, {
      actorUserId: data.user.id,
      actorRole: "client_owner",
      source: "CLIENT_MANUAL",
      actionType: "account_created",
      target: data.user.id,
      newState: { email },
    });
  }

  if (!data.session) {
    redirect(`/register/check-email?email=${encodeURIComponent(email)}`);
  }

  redirect("/register/details");
}

export async function completeRegistrationAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session has expired. Please log in and try again." };
  }

  const parsed = detailsSchema.safeParse({
    businessType: formData.get("businessType"),
    legalName: formData.get("legalName"),
    planCode: formData.get("planCode"),
    billingTerm: formData.get("billingTerm"),
    amount: formData.get("amount"),
    transactionRef: formData.get("transactionRef"),
    paymentDate: formData.get("paymentDate"),
    promoOptIn: formData.get("promoOptIn"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { businessType, legalName, planCode, billingTerm, amount, transactionRef, paymentDate, promoOptIn } =
    parsed.data;

  // Required document + detail-field checks (business-type specific, spec section 4.2)
  const requirements = BUSINESS_TYPE_REQUIREMENTS[businessType as BusinessType];
  const details: Record<string, string> = {};
  for (const field of requirements.details) {
    const value = (formData.get(`detail_${field.key}`) as string | null)?.trim() ?? "";
    if (field.required && !value) {
      return { error: `${field.label} is required` };
    }
    if (value) details[field.key] = value;
  }

  const documentFiles: { key: string; file: File }[] = [];
  for (const doc of requirements.documents) {
    const file = formData.get(`doc_${doc.key}`) as File | null;
    const hasFile = file && file.size > 0;
    if (doc.required && !hasFile) {
      return { error: `${doc.label} is required` };
    }
    if (hasFile) documentFiles.push({ key: doc.key, file: file! });
  }

  // Every mandatory policy must have been accepted (double-checked server-side,
  // client already disables Submit until all are checked — spec section 5).
  for (const policyType of REQUIRED_POLICY_TYPES) {
    if (formData.get(`consent_${policyType}`) !== "true") {
      return { error: "All mandatory policy acknowledgements must be accepted before submitting." };
    }
  }

  const paymentScreenshot = formData.get("paymentScreenshot") as File | null;

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id")
    .eq("code", planCode)
    .single();
  if (planError || !plan) {
    return { error: "Selected package could not be found." };
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ legal_name: legalName, business_type: businessType, created_by: user.id, promo_opt_in: promoOptIn })
    .select("id")
    .single();
  if (orgError || !org) {
    return { error: `Could not create your organization: ${orgError?.message ?? "unknown error"}` };
  }
  const orgId = org.id as string;

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({ org_id: orgId, user_id: user.id, member_role: "owner" });
  if (memberError) {
    return { error: `Could not link your account: ${memberError.message}` };
  }

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .insert({ org_id: orgId, plan_id: plan.id, billing_term: billingTerm, status: "pending" })
    .select("id")
    .single();
  if (subError || !subscription) {
    return { error: `Could not create your subscription: ${subError?.message ?? "unknown error"}` };
  }

  const { data: verification, error: verificationError } = await supabase
    .from("business_verifications")
    .insert({ org_id: orgId, status: "draft", details })
    .select("id")
    .single();
  if (verificationError || !verification) {
    return { error: `Could not start verification: ${verificationError?.message ?? "unknown error"}` };
  }

  try {
    for (const { key, file } of documentFiles) {
      const path = await uploadOrgFile(supabase, "verification-documents", orgId, file);
      const { error: docError } = await supabase.from("verification_documents").insert({
        verification_id: verification.id,
        org_id: orgId,
        doc_type: key,
        storage_path: path,
        uploaded_by: user.id,
      });
      if (docError) throw new Error(docError.message);
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Document upload failed" };
  }

  await supabase
    .from("business_verifications")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", verification.id);

  await supabase.from("organizations").update({ status: "pending_approval" }).eq("id", orgId);

  let screenshotPath: string | null = null;
  if (paymentScreenshot && paymentScreenshot.size > 0) {
    try {
      screenshotPath = await uploadOrgFile(supabase, "payment-screenshots", orgId, paymentScreenshot);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Payment screenshot upload failed" };
    }
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    org_id: orgId,
    subscription_id: subscription.id,
    amount,
    transaction_ref: transactionRef,
    payment_date: paymentDate,
    screenshot_path: screenshotPath,
    status: "pending_verification",
  });
  if (paymentError) {
    return { error: `Could not record your payment: ${paymentError.message}` };
  }

  const { data: policies } = await supabase
    .from("policy_versions")
    .select("id, policy_type")
    .in("policy_type", REQUIRED_POLICY_TYPES)
    .eq("is_current", true);

  if (policies && policies.length > 0) {
    const { ipAddress, userAgent } = getRequestMeta();
    const consentRows = policies.map((p) => ({
      org_id: orgId,
      user_id: user.id,
      policy_version_id: p.id,
      accepted: true,
      ip_address: ipAddress,
      user_agent: userAgent,
    }));
    await supabase.from("consent_records").insert(consentRows);
  }

  await logAudit(supabase, {
    orgId,
    actorUserId: user.id,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "registration_submitted",
    target: orgId,
    newState: { status: "pending_approval", planCode, billingTerm },
  });

  redirect("/pending");
}

export async function checkPostLoginRedirect(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return getPostLoginRedirect(supabase, user.id);
}
