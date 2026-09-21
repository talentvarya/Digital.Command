import { redirect } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LocalSeoProfileForm } from "@/components/local-seo/LocalSeoProfileForm";
import { CitationChecklist } from "@/components/local-seo/CitationChecklist";
import { GbpPostCard } from "@/components/local-seo/GbpPostCard";
import { DraftGbpPostButton } from "@/components/local-seo/DraftGbpPostButton";
import { LOCAL_CITATION_DIRECTORIES } from "@/lib/constants/local-seo";
import { getNapFields } from "@/lib/visibility/nap";
import type { LocalSeoPost, LocalSeoProfile } from "@/types/database";

export default async function LocalSeoPage() {
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

  const [{ data: profile }, { data: brand }, { data: posts }] = await Promise.all([
    supabase.from("local_seo_profiles").select("*").eq("org_id", orgId).maybeSingle(),
    supabase.from("brand_profiles").select("phone, whatsapp, locations").eq("org_id", orgId).maybeSingle(),
    supabase.from("local_seo_posts").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
  ]);

  const localProfile = (profile as LocalSeoProfile | null) ?? null;
  const postList = (posts as LocalSeoPost[] | null) ?? [];

  const napFields = getNapFields({ local: localProfile, brand });
  const napComplete = napFields.every((f) => f.filled);
  const citationsCompleted = localProfile?.citations_completed ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Local SEO Toolkit</h1>
        <p className="text-sm text-ink-500">
          Real Google Business Profile posting needs Google&apos;s own API access (a 60+ day verified profile plus a
          formal request) — until that&apos;s in place, this keeps your name/address/phone consistent, tracks where
          you&apos;re listed, and drafts Google Post text + local keywords you copy onto your own GBP account.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-2 text-lg font-semibold text-ink-900">NAP consistency check</h2>
        <div className="space-y-1.5">
          {napFields.map((f) => (
            <div key={f.label} className="flex items-center gap-2 text-sm">
              {f.filled ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              )}
              <span className={f.filled ? "text-ink-700" : "text-ink-500"}>{f.label}</span>
            </div>
          ))}
        </div>
        {!napComplete && (
          <p className="mt-2 text-xs text-amber-700">
            Fill in what&apos;s missing below — inconsistent business info across the web is one of the most common
            reasons a local business doesn&apos;t show up reliably.
          </p>
        )}
      </div>

      <LocalSeoProfileForm profile={localProfile} />

      <CitationChecklist completed={citationsCompleted} />

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">Google Post drafts</h2>
          <span className="text-xs text-ink-400">
            {citationsCompleted.length}/{LOCAL_CITATION_DIRECTORIES.length} directories listed
          </span>
        </div>
        <DraftGbpPostButton />
        <div className="space-y-3">
          {postList.length === 0 && <p className="text-center text-sm text-ink-400">No posts drafted yet.</p>}
          {postList.map((post) => (
            <GbpPostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}
