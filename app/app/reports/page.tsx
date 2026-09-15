import { redirect } from "next/navigation";
import { Search, Eye, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GenerateReportForm } from "@/components/reports/GenerateReportForm";
import { ReportCard } from "@/components/reports/ReportCard";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { CHART_COLORS } from "@/components/charts/StatCard";

export default async function ReportsPage() {
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

  const [{ data: reports }, { data: scHistory }, { data: gaHistory }] = await Promise.all([
    supabase.from("reports").select("*").eq("org_id", membership.org_id).order("generated_at", { ascending: false }).limit(20),
    supabase
      .from("search_console_snapshots")
      .select("synced_at, total_clicks, total_impressions")
      .eq("org_id", membership.org_id)
      .order("synced_at", { ascending: true })
      .limit(30),
    supabase
      .from("analytics_snapshots")
      .select("synced_at, sessions")
      .eq("org_id", membership.org_id)
      .order("synced_at", { ascending: true })
      .limit(30),
  ]);

  const clicksTrend = (scHistory ?? []).map((s) => ({ date: s.synced_at, value: s.total_clicks }));
  const impressionsTrend = (scHistory ?? []).map((s) => ({ date: s.synced_at, value: s.total_impressions }));
  const sessionsTrend = (gaHistory ?? []).map((s) => ({ date: s.synced_at, value: s.sessions }));
  const hasAnyTrend = clicksTrend.length + impressionsTrend.length + sessionsTrend.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Reports</h1>
        <p className="text-sm text-ink-500">
          Generated from your real SEO audit, Search Console, Analytics, and planner data — never invented numbers.
        </p>
      </div>

      {hasAnyTrend && (
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Performance Trends</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <Search className="h-3.5 w-3.5" style={{ color: CHART_COLORS.orange }} />
                Organic clicks
              </div>
              <TrendLineChart points={clicksTrend} color={CHART_COLORS.orange} />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <Eye className="h-3.5 w-3.5" style={{ color: CHART_COLORS.blue }} />
                Impressions
              </div>
              <TrendLineChart points={impressionsTrend} color={CHART_COLORS.blue} />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <Users className="h-3.5 w-3.5" style={{ color: CHART_COLORS.aqua }} />
                Sessions
              </div>
              <TrendLineChart points={sessionsTrend} color={CHART_COLORS.aqua} />
            </div>
          </div>
        </div>
      )}

      <GenerateReportForm />

      <div className="space-y-4">
        {(reports ?? []).length === 0 && (
          <p className="card text-center text-sm text-ink-400">No reports yet — generate your first one above.</p>
        )}
        {(reports ?? []).map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </div>
  );
}
