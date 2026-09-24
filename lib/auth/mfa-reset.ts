import type { SupabaseClient } from "@supabase/supabase-js";

// What the "Set a new password" page should show.
//
// A reset link signs the person in at assurance level 1. When the account has a
// verified authenticator app, Supabase refuses to change the password until the
// session has been raised to level 2 with a code from that app ("AAL2 session is
// required to update email or password when MFA is enabled"). Without this step
// an account like that — in practice the Super Admin — could never finish a
// password reset.
export type ResetStep = "expired" | "verify_code" | "set_password";

export async function getResetStep(supabase: SupabaseClient): Promise<ResetStep> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return "expired"; // no reset session: the link was used, expired, or never clicked

  // listFactors asks the server, not the cached session, so an authenticator that
  // was removed after the link was clicked doesn't leave the person stuck here.
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) return error.status === 401 || error.status === 403 ? "expired" : "set_password";
  if (!factors?.totp?.some((f) => f.status === "verified")) return "set_password";

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return aal?.currentLevel === "aal2" ? "set_password" : "verify_code";
}

// Raises the current session to level 2 using the account's verified authenticator.
export async function verifyAuthenticatorCode(supabase: SupabaseClient, code: string): Promise<{ error?: string }> {
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { error: listError.message };

  const factor = factors?.totp?.find((f) => f.status === "verified");
  if (!factor) return { error: "No authenticator app is set up on this account." };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError || !challenge) return { error: challengeError?.message ?? "Could not start the code check." };

  const { error } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: code.replace(/\s+/g, ""), // people type "123 456"
  });
  return error ? { error: error.message } : {};
}
