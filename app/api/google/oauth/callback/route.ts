import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import type { GoogleService } from "@/types/database";

export async function GET(request: NextRequest) {
  const seoUrl = new URL("/app/seo", request.url);
  const params = request.nextUrl.searchParams;

  if (params.get("error")) {
    seoUrl.searchParams.set("google_error", params.get("error") ?? "access_denied");
    return NextResponse.redirect(seoUrl);
  }

  const code = params.get("code");
  const state = params.get("state");
  const cookieState = cookies().get("google_oauth_state")?.value;
  cookies().delete("google_oauth_state");

  if (!code || !state || !cookieState || state !== cookieState) {
    seoUrl.searchParams.set("google_error", "invalid_state");
    return NextResponse.redirect(seoUrl);
  }

  const service = state.split(".")[1] as GoogleService;
  if (service !== "search_console" && service !== "analytics") {
    seoUrl.searchParams.set("google_error", "invalid_state");
    return NextResponse.redirect(seoUrl);
  }

  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) {
    seoUrl.searchParams.set("google_error", "not_logged_in");
    return NextResponse.redirect(seoUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const { data: existing } = await supabase
      .from("google_connections")
      .select("refresh_token")
      .eq("org_id", member.orgId)
      .eq("service", service)
      .maybeSingle();

    await supabase.from("google_connections").upsert(
      {
        org_id: member.orgId,
        service,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        status: "connected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,service" }
    );

    await logAudit(supabase, {
      orgId: member.orgId,
      actorUserId: member.userId,
      actorRole: "client_owner",
      source: "CLIENT_MANUAL",
      actionType: "google_service_connected",
      target: service,
    });

    seoUrl.searchParams.set("connected", service);
    return NextResponse.redirect(seoUrl);
  } catch (err) {
    seoUrl.searchParams.set("google_error", err instanceof Error ? err.message : "connection_failed");
    return NextResponse.redirect(seoUrl);
  }
}
