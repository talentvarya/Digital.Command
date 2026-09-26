import { Search, Target, Users, Gauge, Download } from "lucide-react";
import { MetricStatCard, CHART_COLORS } from "@/components/charts/StatCard";
import type { Report } from "@/types/database";
import type { ReportMetricsInput } from "@/lib/ai/generate-report";

export function ReportCard({ report }: { report: Report }) {
  const metrics = report.metrics_snapshot as unknown as ReportMetricsInput;

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink-900">
            {report.period_start} — {report.period_end}
          </h3>
          <span className="text-xs text-ink-400">{new Date(report.generated_at).toLocaleString()}</span>
        </div>
        {/* A plain link: the file comes straight from the server, no page navigation. */}
        <a href={`/app/reports/${report.id}/pdf`} download className="btn-secondary px-3 py-2">
          <Download className="mr-1.5 h-4 w-4" /> Download PDF
        </a>
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase text-ink-400">Work Completed</h4>
        <p className="whitespace-pre-line text-sm text-ink-700">{report.summary_text}</p>
      </div>

      {report.next_plan_text && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase text-ink-400">Next Plan</h4>
          <p className="whitespace-pre-line text-sm text-ink-700">{report.next_plan_text}</p>
        </div>
      )}

      <div className="grid gap-3 border-t border-ink-50 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.seoAudit && (
          <MetricStatCard
            icon={Gauge}
            label="SEO Health Score"
            current={metrics.seoAudit.score}
            previous={metrics.seoAudit.previousScore}
            formatter={(v) => `${v}/100`}
            color={CHART_COLORS.blue}
          />
        )}
        {metrics.searchConsole && (
          <>
            <MetricStatCard
              icon={Search}
              label="Search Console Clicks"
              current={metrics.searchConsole.clicks}
              previous={metrics.searchConsole.previousClicks}
              color={CHART_COLORS.orange}
            />
            <MetricStatCard
              icon={Target}
              label="Average Position"
              current={metrics.searchConsole.avgPosition}
              previous={metrics.searchConsole.previousAvgPosition}
              higherIsBetter={false}
              formatter={(v) => v.toFixed(1)}
              color={CHART_COLORS.violet}
            />
          </>
        )}
        {metrics.analytics && (
          <MetricStatCard
            icon={Users}
            label="Sessions"
            current={metrics.analytics.sessions}
            previous={metrics.analytics.previousSessions}
            color={CHART_COLORS.aqua}
          />
        )}
      </div>
    </div>
  );
}
