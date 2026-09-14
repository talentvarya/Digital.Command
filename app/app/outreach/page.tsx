import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMentionsPanel } from "@/components/outreach/BrandMentionsPanel";
import { AddOpportunityForm } from "@/components/outreach/AddOpportunityForm";
import { OpportunityCard } from "@/components/outreach/OpportunityCard";

export default async function OutreachPage() {
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

  const [{ data: org }, { data: mentionSearches }, { data: opportunities }] = await Promise.all([
    supabase.from("organizations").select("legal_name").eq("id", orgId).single(),
    supabase.from("brand_mention_searches").select("*").eq("org_id", orgId).order("searched_at", { ascending: false }).limit(1),
    supabase.from("off_page_opportunities").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
  ]);

  const opportunityIds = (opportunities ?? []).map((o) => o.id);
  const { data: messages } = opportunityIds.length
    ? await supabase.from("outreach_messages").select("*").in("opportunity_id", opportunityIds).order("created_at", { ascending: true })
    : { data: [] };

  const messagesByOpportunity = new Map<string, typeof messages>();
  (messages ?? []).forEach((m) => {
    const list = messagesByOpportunity.get(m.opportunity_id) ?? [];
    list.push(m);
    messagesByOpportunity.set(m.opportunity_id, list);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Off-Page &amp; Outreach</h1>
        <p className="text-sm text-ink-500">
          Bring a candidate URL you found — Digital Command assesses it, drafts personalized outreach, and tracks
          the backlink once you have it. No mass/automated outreach, ever.
        </p>
      </div>

      <BrandMentionsPanel defaultQuery={org?.legal_name ?? ""} latestSearch={mentionSearches?.[0] ?? null} />

      <AddOpportunityForm />

      <div className="space-y-4">
        {(opportunities ?? []).length === 0 && (
          <p className="card text-center text-sm text-ink-400">No opportunities yet — add one above.</p>
        )}
        {(opportunities ?? []).map((opportunity) => (
          <OpportunityCard key={opportunity.id} opportunity={opportunity} messages={messagesByOpportunity.get(opportunity.id) ?? []} />
        ))}
      </div>
    </div>
  );
}
