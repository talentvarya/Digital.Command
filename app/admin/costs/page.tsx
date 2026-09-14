import { createClient } from "@/lib/supabase/server";
import { CostRow } from "@/components/admin/CostRow";
import { monthlyEquivalent } from "@/lib/constants/plans";

export default async function AdminCostsPage() {
  const supabase = createClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [{ data: orgs }, { data: subscriptions }, { data: plans }, { data: settings }, { data: usageEvents }] = await Promise.all([
    supabase.from("organizations").select("id, legal_name").eq("status", "active").order("legal_name", { ascending: true }),
    supabase.from("subscriptions").select("org_id, plan_id, billing_term, status").eq("status", "active"),
    supabase.from("plans").select("id, price_quarterly, price_half_yearly, price_yearly"),
    supabase
      .from("client_settings")
      .select("org_id, manual_buffer_cost_usd, manual_storage_cost_usd, manual_other_cost_usd, manual_other_cost_label"),
    supabase.from("ai_usage_events").select("org_id, estimated_cost_usd").gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const planById = new Map((plans ?? []).map((p) => [p.id, p]));
  const subscriptionByOrg = new Map((subscriptions ?? []).map((s) => [s.org_id, s]));
  const settingsByOrg = new Map((settings ?? []).map((s) => [s.org_id, s]));
  const aiCostByOrg = new Map<string, number>();
  (usageEvents ?? []).forEach((e) => {
    aiCostByOrg.set(e.org_id, (aiCostByOrg.get(e.org_id) ?? 0) + e.estimated_cost_usd);
  });

  const rows = (orgs ?? []).map((org) => {
    const sub = subscriptionByOrg.get(org.id);
    const plan = sub ? planById.get(sub.plan_id) : null;
    const priceField = sub?.billing_term === "quarterly" ? plan?.price_quarterly : sub?.billing_term === "half_yearly" ? plan?.price_half_yearly : plan?.price_yearly;
    const revenueInr = sub && plan ? monthlyEquivalent(priceField ?? null, sub.billing_term) : 0;
    const settingsRow = settingsByOrg.get(org.id);
    return {
      orgId: org.id,
      legalName: org.legal_name,
      revenueInr,
      aiCostUsd: aiCostByOrg.get(org.id) ?? 0,
      manualBufferCostUsd: settingsRow?.manual_buffer_cost_usd ?? null,
      manualStorageCostUsd: settingsRow?.manual_storage_cost_usd ?? null,
      manualOtherCostUsd: settingsRow?.manual_other_cost_usd ?? null,
      manualOtherCostLabel: settingsRow?.manual_other_cost_label ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Client Cost / Profit</h1>
        <p className="text-sm text-ink-500">
          Revenue is monthly-equivalent from each client&apos;s active plan. AI cost is real, auto-tracked per API call
          (last 30 days). Buffer/storage/other costs have no API to pull from — enter your own estimate. A client
          never sees this page or this data.
        </p>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && <p className="card text-center text-sm text-ink-400">No active clients yet.</p>}
        {rows.map((row) => (
          <CostRow key={row.orgId} {...row} />
        ))}
      </div>
    </div>
  );
}
