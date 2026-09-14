import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewConversionLinkForm } from "@/components/conversions/NewConversionLinkForm";
import { ConversionLinkRow } from "@/components/conversions/ConversionLinkRow";
import { LogConversionForm } from "@/components/conversions/LogConversionForm";
import { FunnelSummary } from "@/components/conversions/FunnelSummary";

export default async function ConversionsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/register/details");
  const orgId = membership.org_id;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [{ data: links }, { data: events }, { data: scSnapshot }, { data: gaSnapshot }] = await Promise.all([
    supabase.from("conversion_links").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.from("conversion_events").select("*").eq("org_id", orgId).gte("created_at", thirtyDaysAgo.toISOString()).order("created_at", { ascending: false }),
    supabase.from("search_console_snapshots").select("total_clicks").eq("org_id", orgId).order("synced_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("analytics_snapshots").select("sessions").eq("org_id", orgId).order("synced_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const eventCounts = (events ?? []).reduce<Record<string, { count: number; value: number }>>((acc, e) => {
    const bucket = acc[e.event_type] ?? { count: 0, value: 0 };
    bucket.count += 1;
    bucket.value += e.value ?? 0;
    acc[e.event_type] = bucket;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Conversions</h1>
        <p className="text-sm text-ink-500">
          Create a trackable link for your WhatsApp button, phone number, or booking form and place it on your own
          website. Log leads and sales directly for anything that doesn&apos;t go through a link.
        </p>
      </div>

      <FunnelSummary
        organicClicks={scSnapshot?.total_clicks ?? null}
        sessions={gaSnapshot?.sessions ?? null}
        eventCounts={eventCounts}
      />

      <NewConversionLinkForm />

      <div className="space-y-2">
        {(links ?? []).length === 0 && <p className="card text-center text-sm text-ink-400">No tracked links yet — add one above.</p>}
        {(links ?? []).map((link) => (
          <ConversionLinkRow key={link.id} link={link} />
        ))}
      </div>

      <LogConversionForm links={links ?? []} />
    </div>
  );
}
