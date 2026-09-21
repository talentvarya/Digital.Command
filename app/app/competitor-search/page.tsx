import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ApifyConnectionForm } from "@/components/competitor-search/ApifyConnectionForm";
import { CompetitorSearchForm } from "@/components/competitor-search/CompetitorSearchForm";
import { SnapshotCard } from "@/components/competitor-search/SnapshotCard";
import type { ApifyConnectionPublic, ApifySearchSnapshot } from "@/types/database";

// A live Apify Maps run takes ~10-30s; the default serverless limit can be shorter.
export const maxDuration = 60;

export default async function CompetitorSearchPage() {
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

  const { data: settings } = await supabase.from("client_settings").select("premium_apify_enabled").eq("org_id", orgId).maybeSingle();

  if (!settings?.premium_apify_enabled) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <Lock className="h-8 w-8 text-ink-300" />
          <h1 className="text-xl font-bold text-ink-900">Competitor Search is a premium add-on</h1>
          <p className="text-sm text-ink-500">
            Real Google Maps results via your own connected Apify account — see exactly who else shows up when
            customers search for what you do, with their rating, reviews, and contact info. Ask your Digital
            Command contact to enable it for your account.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: connection }, { data: snapshots }] = await Promise.all([
    supabase.from("apify_connections").select("org_id, status, connected_at, last_used_at").eq("org_id", orgId).maybeSingle(),
    supabase.from("apify_search_snapshots").select("*").eq("org_id", orgId).order("run_at", { ascending: false }).limit(20),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Competitor Search</h1>
        <p className="text-sm text-ink-500">
          Real Google Maps results for any search + area — see who else shows up, their rating and reviews, and
          where you rank among them, pulled live via your own Apify account.
        </p>
      </div>

      <ApifyConnectionForm connection={(connection as ApifyConnectionPublic | null) ?? null} />

      {connection?.status === "connected" && <CompetitorSearchForm />}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink-900">Recent searches</h2>
        {(!snapshots || snapshots.length === 0) && (
          <p className="card text-center text-sm text-ink-400">No searches run yet.</p>
        )}
        {(snapshots as ApifySearchSnapshot[] | null)?.map((s) => (
          <SnapshotCard key={s.id} snapshot={s} />
        ))}
      </div>
    </div>
  );
}
