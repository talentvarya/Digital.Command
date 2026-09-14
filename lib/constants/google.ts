import type { GoogleService } from "@/types/database";

export const GOOGLE_SERVICE_LABELS: Record<GoogleService, string> = {
  search_console: "Google Search Console",
  analytics: "Google Analytics",
};

export const REPORT_PERIOD_DAYS = [7, 14] as const;
