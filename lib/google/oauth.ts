import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoogleService } from "@/types/database";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const SCOPES: Record<GoogleService, string> = {
  search_console: "https://www.googleapis.com/auth/webmasters.readonly",
  analytics: "https://www.googleapis.com/auth/analytics.readonly",
};

function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/oauth/callback`;
}

export function buildAuthUrl(service: GoogleService, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES[service],
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Server-only: reads and, if needed, refreshes the stored token. Never call
// this from anything that returns its result to a Client Component.
export async function getValidAccessToken(
  supabase: SupabaseClient,
  orgId: string,
  service: GoogleService
): Promise<string | null> {
  const { data: connection } = await supabase
    .from("google_connections")
    .select("id, access_token, refresh_token, token_expires_at, status")
    .eq("org_id", orgId)
    .eq("service", service)
    .maybeSingle();

  if (!connection || connection.status !== "connected" || !connection.access_token) return null;

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return connection.access_token;
  }

  if (!connection.refresh_token) return null;

  try {
    const refreshed = await refreshAccessToken(connection.refresh_token);
    await supabase
      .from("google_connections")
      .update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
    return refreshed.access_token;
  } catch {
    await supabase
      .from("google_connections")
      .update({ status: "reconnect_required", updated_at: new Date().toISOString() })
      .eq("id", connection.id);
    return null;
  }
}
