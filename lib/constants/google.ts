import type { GoogleService } from "@/types/database";

export const GOOGLE_SERVICE_LABELS: Record<GoogleService, string> = {
  search_console: "Google Search Console",
  analytics: "Google Analytics",
  youtube: "YouTube",
};

export const VALID_GOOGLE_SERVICES: GoogleService[] = ["search_console", "analytics", "youtube"];

export function isGoogleService(value: string | null): value is GoogleService {
  return VALID_GOOGLE_SERVICES.includes(value as GoogleService);
}

export const REPORT_PERIOD_DAYS = [7, 14, 30, 60, 90, 180, 365] as const;

// Friendly labels for the longer periods — "Last 90 days" reads worse than
// "Last 3 months" once you're past a month or two.
export const REPORT_PERIOD_LABELS: Record<(typeof REPORT_PERIOD_DAYS)[number], string> = {
  7: "Last 7 days",
  14: "Last 14 days",
  30: "Last 30 days",
  60: "Last 60 days",
  90: "Last 3 months",
  180: "Last 6 months",
  365: "Last 12 months",
};
