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

export type ContentControlMode = "autopilot" | "approval_required";

export interface ClientSettings {
  org_id: string;
  automation_status: string;
  master_stop: boolean;
  content_control_mode: ContentControlMode;
  approval_then_autopilot: boolean;
  autopilot_since: string | null;
}

export interface BrandProfile {
  org_id: string;
  logo_path: string | null;
  colors: string[];
  fonts: string[];
  business_description: string | null;
  products_services: string | null;
  target_audience: string | null;
  locations: string | null;
  phone: string | null;
  whatsapp: string | null;
  offers: string | null;
  cta_style: string | null;
  preferred_tone: string | null;
  words_to_avoid: string[];
  image_style: string | null;
  video_style: string | null;
  competitors: string[];
  reference_content: string | null;
  approved_examples: string | null;
  updated_at: string;
}

export type LinkType =
  | "website"
  | "blog"
  | "google_business_profile"
  | "facebook"
  | "instagram"
  | "youtube"
  | "x"
  | "pinterest"
  | "other";

export type LinkStatus = "connected" | "not_added" | "reconnect_required" | "error";

export interface OrgLink {
  id: string;
  org_id: string;
  link_type: LinkType;
  url: string;
  label: string | null;
  status: LinkStatus;
  last_checked_at: string | null;
  last_check_result: string | null;
}

export type ContentPlatform = "facebook" | "instagram" | "youtube";

export type ContentStatus =
  | "draft"
  | "waiting_approval"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected"
  | "skipped";

export type ContentSource = "ai_generated" | "client_uploaded" | "admin_created" | "gpt_assistant_generated";

export interface ContentItem {
  id: string;
  org_id: string;
  platform: ContentPlatform;
  scheduled_date: string;
  scheduled_time: string | null;
  caption: string | null;
  hashtags: string[];
  status: ContentStatus;
  source: ContentSource;
  control_mode: ContentControlMode;
  locked: boolean;
  rejection_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContentMedia {
  id: string;
  content_item_id: string;
  org_id: string;
  media_type: "image" | "video";
  storage_path: string;
}

export interface ContentVersion {
  id: string;
  content_item_id: string;
  org_id: string;
  version_number: number;
  caption: string | null;
  hashtags: string[];
  generated_by: "ai" | "client_suggestion" | "client_edit" | "admin";
  client_suggestion_text: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  org_id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
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

export type GoogleService = "search_console" | "analytics";
export type GoogleConnectionStatus = "connected" | "not_added" | "reconnect_required" | "error";

// Safe-to-render shape — never includes access_token/refresh_token. See
// SECURITY_AND_RLS.md: queries used for UI must select only these columns.
export interface GoogleConnectionPublic {
  id: string;
  org_id: string;
  service: GoogleService;
  external_property: string | null;
  status: GoogleConnectionStatus;
  last_synced_at: string | null;
}

export interface SeoIssue {
  severity: "critical" | "warning" | "info";
  type: string;
  message: string;
}

export interface SeoAudit {
  id: string;
  org_id: string;
  url: string;
  score: number;
  issues: SeoIssue[];
  crawled_at: string;
  triggered_by: string | null;
}

export interface SearchConsoleQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsolePageRow {
  page: string;
  clicks: number;
  impressions: number;
}

export interface SearchConsoleSnapshot {
  id: string;
  org_id: string;
  synced_at: string;
  site_url: string;
  date_range_start: string;
  date_range_end: string;
  total_clicks: number;
  total_impressions: number;
  avg_ctr: number;
  avg_position: number;
  top_queries: SearchConsoleQueryRow[];
  top_pages: SearchConsolePageRow[];
}

export interface AnalyticsSnapshot {
  id: string;
  org_id: string;
  synced_at: string;
  property_id: string;
  date_range_start: string;
  date_range_end: string;
  sessions: number;
  users: number;
  conversions: number;
  top_pages: { page: string; sessions: number }[];
}

export interface Report {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  generated_by: string | null;
  metrics_snapshot: Record<string, unknown>;
  summary_text: string | null;
  next_plan_text: string | null;
}
