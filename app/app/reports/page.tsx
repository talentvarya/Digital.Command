import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GenerateReportForm } from "@/components/reports/GenerateReportForm";
import { ReportCard } from "@/components/reports/ReportCard";

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

  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("org_id", membership.org_id)
    .order("generated_at", { ascending: false })
    .limit(20);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Reports</h1>
        <p className="text-sm text-ink-500">
          Generated from your real SEO audit, Search Console, Analytics, and planner data — never invented numbers.
        </p>
      </div>

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
