import type { ContentPlatform, LinkType } from "@/types/database";

export const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
};

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  website: "Website",
  blog: "Blog",
  google_business_profile: "Google Business Profile",
  facebook: "Facebook Page",
  instagram: "Instagram Profile",
  youtube: "YouTube Channel",
  x: "X (Twitter)",
  pinterest: "Pinterest",
  other: "Other",
};

// Facebook/Instagram/YouTube/GBP need OAuth (Buffer/Graph API) to actually
// "Connect Account" — that's Phase 4. Every link type can still be tracked
// manually (URL + health check) today.
export const OAUTH_LINK_TYPES: LinkType[] = ["facebook", "instagram", "youtube", "google_business_profile"];

export const REJECTIONS_BEFORE_SUGGESTION = 3;

// Safety ceiling, not a package entitlement — spec §32's per-package numbers
// (e.g. "12 FB/IG content sets/month") describe delivered content, not raw AI
// generation attempts, and the spec itself says limits are provisional
// ("tuned after the first 5–10 paying clients"). This exists so nothing can
// generate unbounded AI spend on one org (spec §30/§36), not to enforce a
// specific package's fair-use number — tune freely once real usage exists.
export const MONTHLY_AI_GENERATION_SAFETY_CAP = 60;
