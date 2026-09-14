import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewCampaignForm } from "@/components/paid-campaigns/NewCampaignForm";
import { CampaignCard } from "@/components/paid-campaigns/CampaignCard";

export default async function PaidCampaignsPage() {
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

  const { data: campaigns } = await supabase
    .from("paid_campaigns")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { data: approvals } = campaignIds.length
    ? await supabase
        .from("paid_campaign_approvals")
        .select("*")
        .in("campaign_id", campaignIds)
        .order("approval_version", { ascending: false })
    : { data: [] };

  const approvalsByCampaign = new Map<string, typeof approvals>();
  (approvals ?? []).forEach((a) => {
    const list = approvalsByCampaign.get(a.campaign_id) ?? [];
    list.push(a);
    approvalsByCampaign.set(a.campaign_id, list);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Paid Advertising</h1>
        <p className="text-sm text-ink-500">
          Prepare a campaign brief, set your own budget and dates, and approve it here. Digital Command never spends
          money automatically — launching always happens manually, in Google Ads or Meta&apos;s own dashboard, and
          only after your approval.
        </p>
      </div>

      <NewCampaignForm />

      <div className="space-y-4">
        {(campaigns ?? []).length === 0 && (
          <p className="card text-center text-sm text-ink-400">No campaigns yet — draft one above.</p>
        )}
        {(campaigns ?? []).map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} approvals={approvalsByCampaign.get(campaign.id) ?? []} />
        ))}
      </div>
    </div>
  );
}
