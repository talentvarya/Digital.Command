export type ProfileRole = "super_admin" | "client_owner" | "client_user" | "client_viewer";

export type BusinessType =
  | "individual"
  | "proprietorship"
  | "partnership"
  | "private_limited"
  | "public_limited";

export type OrganizationStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "paused"
  | "expired"
  | "rejected";

export type BillingTerm = "quarterly" | "half_yearly" | "yearly";

export type VerificationStatus =
  | "draft"
  | "submitted"
  | "pending_review"
  | "more_documents_required"
  | "approved"
  | "rejected";

export type PaymentStatus = "pending_verification" | "verified" | "rejected";

export type AuditSource = "AUTOPILOT" | "CLIENT_MANUAL" | "ADMIN" | "GPT_ASSISTANT";

export interface Profile {
  id: string;
  full_name: string;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  legal_name: string;
  business_type: BusinessType;
  status: OrganizationStatus;
  promo_opt_in: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  org_id: string;
  user_id: string;
  member_role: "owner" | "user" | "viewer";
  created_at: string;
}

export interface Plan {
  id: string;
  code: "package_a" | "package_b" | "custom";
  name: string;
  websites_included: number;
  smo_packages_included: number;
  is_custom: boolean;
  price_quarterly: number | null;
  price_half_yearly: number | null;
  price_yearly: number | null;
}

export interface Subscription {
  id: string;
  org_id: string;
  plan_id: string;
  billing_term: BillingTerm;
  status: "pending" | "active" | "expired" | "cancelled";
  start_date: string | null;
  expiry_date: string | null;
}

export type PolicyType =
  | "terms"
  | "privacy"
  | "package_scope"
  | "verification_consent"
  | "marketing_authorization"
  | "data_retention"
  | "refund_cancellation"
  | "audit_logging_consent"
  | "third_party_disclosure"
  | "authorized_representative";

export interface PolicyVersion {
  id: string;
  policy_type: PolicyType;
  version: string;
  title: string;
  body: string;
  is_current: boolean;
  effective_date: string;
}

export interface BusinessVerification {
  id: string;
  org_id: string;
  status: VerificationStatus;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reason: string | null;
}

export interface VerificationDocument {
  id: string;
  verification_id: string;
  org_id: string;
  doc_type: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

export interface Payment {
  id: string;
  org_id: string;
  subscription_id: string;
  amount: number;
  transaction_ref: string;
  payment_date: string;
  screenshot_path: string | null;
  status: PaymentStatus;
  submitted_at: string;
  verified_by: string | null;
  verified_at: string | null;
  reason: string | null;
}

export interface ClientSettings {
  org_id: string;
  automation_status: string;
  master_stop: boolean;
}

export interface AuditLog {
  id: string;
  org_id: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  source: AuditSource;
  action_type: string;
  target: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  result: "success" | "failure";
  failure_reason: string | null;
  created_at: string;
}
