import type { AdPlatform, BudgetPeriod, PaidCampaignStatus } from "@/types/database";

export const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  google_ads: "Google Ads",
  meta_facebook: "Facebook Ads",
  meta_instagram: "Instagram Ads",
  youtube_ads: "YouTube Ads",
  other: "Other",
};

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  daily: "Daily budget",
  total_campaign: "Total campaign budget",
};

export const CAMPAIGN_OBJECTIVE_OPTIONS = [
  "Website traffic",
  "Lead generation",
  "Brand awareness",
  "Sales / conversions",
  "App installs",
  "Local store visits",
  "Video views",
  "Other",
];

// Admin can move a launched campaign through its real-world lifecycle, but can
// never set draft/pending_approval/approved/rejected — that authorization step
// belongs to the client alone (spec §14/§36, master prompt rule #6). Enforced
// in app/admin/clients/[orgId]/paid-campaign-actions.ts, not just referenced here.
export const ADMIN_SETTABLE_STATUSES: PaidCampaignStatus[] = ["launched_externally", "paused", "completed", "cancelled"];
