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

export const REPORT_PERIOD_DAYS = [7, 14] as const;
