import { Users, UserPlus, CheckCircle2, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LeadCard } from "@/components/admin/LeadCard";
import { MetricStatCard, CHART_COLORS } from "@/components/charts/StatCard";
import { TrendLineChart, type TrendPoint } from "@/components/charts/TrendLineChart";
import type { RoadmapLead } from "@/types/database";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default async function AdminLeadsPage() {
  const supabase = createClient();

  const { data: leads } = await supabase.from("roadmap_leads").select("*").order("created_at", { ascending: false });
  const leadList = (leads ?? []) as RoadmapLead[];

  const now = new Date();
  const sevenDaysAgo = startOfDay(new Date(now.getTime() - 7 * 86400000));
  const fourteenDaysAgo = startOfDay(new Date(now.getTime() - 14 * 86400000));

  const last7 = leadList.filter((l) => new Date(l.created_at) >= sevenDaysAgo).length;
  const prev7 = leadList.filter((l) => new Date(l.created_at) >= fourteenDaysAgo && new Date(l.created_at) < sevenDaysAgo).length;

  const newCount = leadList.filter((l) => l.status === "new").length;
  const convertedCount = leadList.filter((l) => l.status === "converted").length;

  // 14-day daily trend — zero-fill every day so the line is continuous; a
  // day with zero leads is a real count, not an invented data point.
  const trendDays: TrendPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = startOfDay(new Date(now.getTime() - i * 86400000));
    const nextDay = new Date(day.getTime() + 86400000);
    const count = leadList.filter((l) => {
      const created = new Date(l.created_at);
      return created >= day && created < nextDay;
    }).length;
    trendDays.push({ date: day.toISOString().slice(0, 10), value: count });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Roadmap Leads</h1>
        <p className="text-sm text-ink-500">
          Everyone who used the free roadmap tool on the homepage — follow up while it&apos;s fresh. No client ever
          sees this page.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricStatCard icon={Users} label="Leads (7 days)" current={last7} previous={prev7 || null} color={CHART_COLORS.blue} />
        <MetricStatCard icon={UserPlus} label="Not yet contacted" current={newCount} previous={null} color={CHART_COLORS.orange} />
        <MetricStatCard icon={CheckCircle2} label="Converted" current={convertedCount} previous={null} color={CHART_COLORS.aqua} />
      </div>

      <div className="card">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <TrendingUp className="h-4 w-4 text-ink-400" />
          Leads per day — last 14 days
        </h2>
        <TrendLineChart points={trendDays} color={CHART_COLORS.blue} />
      </div>

      <div className="space-y-3">
        {leadList.length === 0 && <p className="card text-center text-sm text-ink-400">No leads yet.</p>}
        {leadList.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}
