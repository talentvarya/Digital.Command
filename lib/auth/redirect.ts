import type { SupabaseClient } from "@supabase/supabase-js";

// Central place that decides where an authenticated user should land —
// used right after login and right after sign-up so the two flows agree.
export async function getPostLoginRedirect(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();

  if (profile?.role === "super_admin") {
    return "/admin/dashboard";
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    return "/register/details";
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("status")
    .eq("id", membership.org_id)
    .single();

  return org?.status === "active" ? "/app/dashboard" : "/pending";
}
