import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Star, MapPin, MessageSquareQuote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeVisibility } from "@/lib/visibility/score";
import { getNapFields } from "@/lib/visibility/nap";
import { LOCAL_CITATION_DIRECTORIES } from "@/lib/constants/local-seo";

function scoreTone(v: number) {
  return v >= 80 ? "text-emerald-600" : v >= 50 ? "text-amber-600" : "text-red-600";
}

function delta(latest: number | undefined, previous: number | undefined) {
  if (latest === undefined || previous === undefined) return null;
  const d = latest - previous;
  if (d === 0) return "no change since the audit before";
  return `${d > 0 ? "+" : ""}${d} since the audit before`;
}

export default async function VisibilityPage() {
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

  const [{ data: seo }, { data: aeo }, { data: local }, { data: brand }, { data: reviews }, { data: maps }, { data: aiChecks }] =
    await Promise.all([
      supabase.from("seo_audits").select("score").eq("org_id", orgId).order("crawled_at", { ascending: false }).limit(2),
      supabase.from("aeo_audits").select("score").eq("org_id", orgId).order("audited_at", { ascending: false }).limit(2),
      supabase.from("local_seo_profiles").select("address, city, state, pincode, gbp_url, citations_completed").eq("org_id", orgId).maybeSingle(),
      supabase.from("brand_profiles").select("phone, whatsapp").eq("org_id", orgId).maybeSingle(),
      supabase.from("reviews").select("rating").eq("org_id", orgId),
      supabase
        .from("apify_search_snapshots")
        .select("query, country_code, own_domain, own_domain_position, run_at")
        .eq("org_id", orgId)
        .order("run_at", { ascending: false })
        .limit(1),
      supabase.from("ai_visibility_checks").select("answered, brand_mentioned").eq("org_id", orgId).order("run_at", { ascending: false }).limit(15),
    ]);

  const nap = getNapFields({ local, brand });
  const knownDirectories = new Set(LOCAL_CITATION_DIRECTORIES.map((d) => d.name));
  const citationsDone = ((local?.citations_completed as string[] | null) ?? []).filter((n) => knownDirectories.has(n)).length;

  const visibility = computeVisibility({
    seoScore: seo?.[0]?.score ?? null,
    aeoScore: aeo?.[0]?.score ?? null,
    napFilled: nap.filter((f) => f.filled).length,
    napTotal: nap.length,
    citationsDone,
    citationsTotal: LOCAL_CITATION_DIRECTORIES.length,
  });

  const deltas: Record<string, string | null> = {
    seo: delta(seo?.[0]?.score, seo?.[1]?.score),
    aeo: delta(aeo?.[0]?.score, aeo?.[1]?.score),
  };

  const ratings = (reviews ?? []).map((r) => r.rating).filter((r): r is number => typeof r === "number");
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const lastMaps = maps?.[0] ?? null;
  const answered = (aiChecks ?? []).filter((c) => c.answered);
  const named = answered.filter((c) => c.brand_mentioned).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Visibility Score</h1>
        <p className="text-sm text-ink-500">
          How ready your business is to be found on Google and in AI answers — built only from checks Digital Command
          actually runs on your own website and profile. It is not a Google or AI ranking, and it doesn&apos;t
          promise one.
        </p>
      </div>

      <div className="card flex flex-col gap-4 sm:flex-row sm:items-center">
        {visibility.overall !== null ? (
          <div
            className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-current text-3xl font-bold [font-variant-numeric:tabular-nums] ${scoreTone(visibility.overall)}`}
          >
            {visibility.overall}
          </div>
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-ink-200 text-2xl font-bold text-ink-300">
            —
          </div>
        )}
        <div className="text-sm text-ink-600">
          {visibility.overall !== null ? (
            <>
              The plain average of the <strong>{visibility.measured}</strong> of 4 measures below that have been
              checked. Anything not measured yet isn&apos;t counted as zero — it&apos;s shown as not measured.
            </>
          ) : (
            <>Nothing measured yet. Run an SEO audit or fill in your business details below to get your first score.</>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {visibility.components.map((c) => (
          <Link key={c.key} href={c.href} className="card group block hover:border-brand-300">
            <div className="mb-1 flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-ink-800">{c.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </div>
            <div className={`text-2xl font-bold [font-variant-numeric:tabular-nums] ${c.value === null ? "text-ink-300" : scoreTone(c.value)}`}>
              {c.value === null ? "Not measured" : `${c.value}/100`}
            </div>
            <div className="mt-0.5 text-xs text-ink-500">{c.detail}</div>
            {deltas[c.key] && <div className="mt-0.5 text-xs text-ink-400">{deltas[c.key]}</div>}
          </Link>
        ))}
      </div>

      <div className="card space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Outside-in signals</h2>
          <p className="text-xs text-ink-500">Real numbers from your own data — shown on their own, not blended into the score above.</p>
        </div>

        <Link href="/app/reputation" className="flex items-start gap-3 rounded-lg border border-ink-100 p-3 hover:bg-ink-50">
          <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-sm">
            <div className="font-medium text-ink-800">Reviews you&apos;ve logged</div>
            <div className="text-ink-500">
              {avgRating !== null ? `${avgRating.toFixed(1)} average across ${ratings.length} rating${ratings.length > 1 ? "s" : ""}` : "None logged yet."}
            </div>
          </div>
        </Link>

        <Link href="/app/competitor-search" className="flex items-start gap-3 rounded-lg border border-ink-100 p-3 hover:bg-ink-50">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div className="text-sm">
            <div className="font-medium text-ink-800">Google Maps position</div>
            <div className="text-ink-500">
              {lastMaps
                ? lastMaps.own_domain_position
                  ? `#${lastMaps.own_domain_position} for "${lastMaps.query}" (${new Date(lastMaps.run_at).toLocaleDateString()})`
                  : `Not in the top results for "${lastMaps.query}" (${new Date(lastMaps.run_at).toLocaleDateString()})`
                : "No competitor search run yet (premium add-on)."}
            </div>
          </div>
        </Link>

        <Link href="/app/ai-visibility" className="flex items-start gap-3 rounded-lg border border-ink-100 p-3 hover:bg-ink-50">
          <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
          <div className="text-sm">
            <div className="font-medium text-ink-800">Named in Google&apos;s AI answers</div>
            <div className="text-ink-500">
              {answered.length
                ? `${named} of ${answered.length} recent AI answers named your business (a sample — AI answers vary by run).`
                : "No AI answer check run yet (premium add-on)."}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
