import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireSuperAdmin(
  supabase: SupabaseClient
): Promise<{ id: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") return { error: "Super Admin access required." };

  return { id: user.id };
}
