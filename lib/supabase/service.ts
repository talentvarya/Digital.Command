import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for trusted, unattended system jobs (cron routes) that
// have no user session to read cookies from — bypasses RLS, so every call
// site using this must apply its own org-scoping (eq("org_id", ...)) rather
// than relying on policies. Never import this into anything reachable from a
// client request without an explicit trust boundary (see the cron route's
// own CRON_SECRET check).
export function createServiceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
