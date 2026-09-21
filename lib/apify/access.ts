import type { SupabaseClient } from "@supabase/supabase-js";
import { tryDecryptSecret } from "@/lib/security/secret-box";
import type { ActionResult } from "@/app/register/actions";

// Shared by every feature that runs on the client's own Apify account.
export async function requirePremiumApify(supabase: SupabaseClient, orgId: string): Promise<ActionResult | null> {
  const { data } = await supabase.from("client_settings").select("premium_apify_enabled").eq("org_id", orgId).maybeSingle();
  if (!data?.premium_apify_enabled) {
    return { error: "This is a premium add-on — ask your Digital Command contact to enable it for your account." };
  }
  return null;
}

// Server-side only: the token is read here to make one API call and is never
// returned to the browser. A stored token that can't be decrypted reads as
// "not connected", so the client is asked to reconnect instead of the page
// crashing.
export async function getConnectedApifyToken(supabase: SupabaseClient, orgId: string): Promise<string | null> {
  const { data } = await supabase.from("apify_connections").select("api_token, status").eq("org_id", orgId).maybeSingle();
  return data?.status === "connected" ? tryDecryptSecret(data.api_token as string | null) : null;
}
