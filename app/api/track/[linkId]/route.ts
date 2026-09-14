import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Public, unauthenticated — hit by anonymous visitors on the client's own
// website (they place this URL as their WhatsApp/call/form button href).
// Works under the anon column-grant + row policy added in
// 0017_phase7_rls.sql (id, org_id, destination only — label/type/created_by
// stay private), never the service-role key. org_id on the inserted event
// is derived server-side from link_id by a trigger (0016), not trusted from
// this request.
export async function GET(request: Request, { params }: { params: { linkId: string } }) {
  const supabase = createClient();
  const { data: link } = await supabase.from("conversion_links").select("id, org_id, destination").eq("id", params.linkId).maybeSingle();

  if (!link) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const url = new URL(request.url);
  await supabase.from("conversion_events").insert({
    link_id: link.id,
    org_id: link.org_id,
    event_type: "click",
    utm_source: url.searchParams.get("utm_source"),
    utm_medium: url.searchParams.get("utm_medium"),
    utm_campaign: url.searchParams.get("utm_campaign"),
  });

  return NextResponse.redirect(link.destination, { status: 302 });
}
