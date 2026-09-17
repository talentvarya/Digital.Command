import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AeoAuditPanel } from "@/components/ai-visibility/AeoAuditPanel";
import type { AeoAudit } from "@/types/database";

export default async function AiVisibilityPage() {
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

  const [{ data: websiteLink }, { data: audits }] = await Promise.all([
    supabase.from("org_links").select("url").eq("org_id", orgId).eq("link_type", "website").maybeSingle(),
    supabase.from("aeo_audits").select("*").eq("org_id", orgId).order("audited_at", { ascending: false }).limit(1),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">AI Search Visibility</h1>
        <p className="text-sm text-ink-500">
          More customers now ask ChatGPT, Gemini, or Perplexity things like &quot;best chocolate shop near me&quot;
          instead of typing it into Google. There&apos;s no API to query those engines directly, so this checks the
          real on-page signals they&apos;re known to rely on — FAQ content, structured data, clear business
          info — and drafts FAQ text you add to your own site to close the gaps.
        </p>
      </div>

      <AeoAuditPanel defaultUrl={websiteLink?.url ?? ""} latestAudit={(audits?.[0] as AeoAudit | undefined) ?? null} />
    </div>
  );
}
