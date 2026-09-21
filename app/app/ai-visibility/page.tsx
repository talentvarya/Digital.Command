import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AeoAuditPanel } from "@/components/ai-visibility/AeoAuditPanel";
import { SchemaMarkupCard } from "@/components/ai-visibility/SchemaMarkupCard";
import { AiAnswerCheck, type AiCheckMode } from "@/components/ai-visibility/AiAnswerCheck";
import { AI_MODE_COST_PER_QUERY_USD, MAX_AI_CHECK_QUERIES } from "@/lib/apify/ai-visibility";
import {
  buildFaqPageJsonLd,
  buildLocalBusinessJsonLd,
  parseFaqPairs,
  toScriptTag,
} from "@/lib/aeo/schema-markup";
import type { AeoAudit, AiVisibilityCheck } from "@/types/database";

// The AI-answer check waits on a live Apify run; the default serverless limit
// is shorter than a run can take.
export const maxDuration = 60;

const PROFILE_LINK_TYPES = ["facebook", "instagram", "youtube", "x", "pinterest", "google_business_profile"];

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

  const [
    { data: org },
    { data: links },
    { data: audits },
    { data: brand },
    { data: local },
    { data: settings },
    { data: apifyConnection },
    { data: checks },
  ] = await Promise.all([
    supabase.from("organizations").select("legal_name").eq("id", orgId).single(),
    supabase.from("org_links").select("link_type, url").eq("org_id", orgId),
    supabase.from("aeo_audits").select("*").eq("org_id", orgId).order("audited_at", { ascending: false }).limit(1),
    supabase.from("brand_profiles").select("business_description, phone, whatsapp").eq("org_id", orgId).maybeSingle(),
    supabase.from("local_seo_profiles").select("address, city, state, pincode, gbp_category").eq("org_id", orgId).maybeSingle(),
    supabase.from("client_settings").select("premium_apify_enabled").eq("org_id", orgId).maybeSingle(),
    supabase.from("apify_connections").select("status").eq("org_id", orgId).maybeSingle(),
    supabase.from("ai_visibility_checks").select("id, org_id, query, engine, answered, brand_mentioned, brand_cited, competitors_mentioned, excerpt, sources, run_at, triggered_by").eq("org_id", orgId).order("run_at", { ascending: false }).limit(15),
  ]);

  const latestAudit = (audits?.[0] as AeoAudit | undefined) ?? null;
  const aiCheckMode: AiCheckMode = !settings?.premium_apify_enabled
    ? "locked"
    : apifyConnection?.status === "connected"
      ? "ready"
      : "connect";
  const suggestedQuery =
    local?.gbp_category && local?.city ? `best ${local.gbp_category.toLowerCase()} in ${local.city}` : null;
  const websiteUrl = links?.find((l) => l.link_type === "website")?.url ?? null;

  const { json: businessJson, missing } = buildLocalBusinessJsonLd({
    name: org?.legal_name ?? "",
    description: brand?.business_description,
    websiteUrl,
    phone: brand?.phone || brand?.whatsapp,
    streetAddress: local?.address,
    city: local?.city,
    state: local?.state,
    pincode: local?.pincode,
    sameAs: (links ?? []).filter((l) => PROFILE_LINK_TYPES.includes(l.link_type)).map((l) => l.url),
  });
  const faqJson = latestAudit?.faq_draft ? buildFaqPageJsonLd(parseFaqPairs(latestAudit.faq_draft)) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">AI Search Visibility</h1>
        <p className="text-sm text-ink-500">
          More customers now ask ChatGPT, Gemini, or Perplexity things like &quot;best chocolate shop near me&quot;
          instead of typing it into Google. This checks the real on-page signals those engines rely on — FAQ content,
          structured data, clear business info — then drafts the FAQ text and builds the schema code to close the gaps.
        </p>
      </div>

      <AeoAuditPanel defaultUrl={websiteUrl ?? ""} latestAudit={latestAudit} />

      <AiAnswerCheck
        mode={aiCheckMode}
        suggestedQuery={suggestedQuery}
        checks={(checks as AiVisibilityCheck[] | null) ?? []}
        costPerQuery={AI_MODE_COST_PER_QUERY_USD}
        maxQueries={MAX_AI_CHECK_QUERIES}
      />

      <SchemaMarkupCard
        businessCode={toScriptTag(businessJson)}
        faqCode={faqJson ? toScriptTag(faqJson) : null}
        missing={missing}
      />
    </div>
  );
}
