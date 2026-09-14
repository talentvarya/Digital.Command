import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireOrgMember(
  supabase: SupabaseClient
): Promise<{ userId: string; orgId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in." };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: "No business is registered on this account yet." };

  return { userId: user.id, orgId: membership.org_id as string };
}
