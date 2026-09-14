// Spec §27 Connection Health Center — pure aggregation over status columns
// that already exist (org_links.status, google_connections.status share the
// same connected|not_added|reconnect_required|error enum). "Rate Limited" is
// deliberately not produced here — no code path in lib/buffer/client.ts or
// lib/youtube/client.ts distinguishes a 429 from any other error yet, and
// with no cron/polling in this app there's nowhere to check it proactively
// anyway (see supabase/README.md). Kept honest rather than faked.
export type HealthStatus = "healthy" | "not_added" | "reconnect_required" | "error";

export function mapConnectionStatus(status: string | null | undefined): HealthStatus {
  if (status === "connected") return "healthy";
  if (status === "reconnect_required") return "reconnect_required";
  if (status === "error") return "error";
  return "not_added";
}
