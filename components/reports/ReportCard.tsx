import { MetricBar } from "./MetricBar";
import type { Report } from "@/types/database";
import type { ReportMetricsInput } from "@/lib/ai/generate-report";

export function ReportCard({ report }: { report: Report }) {
  const metrics = report.metrics_snapshot as unknown as ReportMetricsInput;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink-900">
          {report.period_start} — {report.period_end}
        </h3>
        <span className="text-xs text-ink-400">{new Date(report.generated_at).toLocaleString()}</span>
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

      <div className="grid gap-4 border-t border-ink-50 pt-4 sm:grid-cols-2">
        {metrics.seoAudit && (
          <MetricBar
            label="SEO Health Score"
            current={metrics.seoAudit.score}
            previous={metrics.seoAudit.previousScore}
            formatter={(v) => `${v}/100`}
          />
        )}
        {metrics.searchConsole && (
          <>
            <MetricBar
              label="Search Console Clicks"
              current={metrics.searchConsole.clicks}
              previous={metrics.searchConsole.previousClicks}
            />
            <MetricBar
              label="Average Position"
              current={metrics.searchConsole.avgPosition}
              previous={metrics.searchConsole.previousAvgPosition}
              higherIsBetter={false}
              formatter={(v) => v.toFixed(1)}
            />
          </>
        )}
        {metrics.analytics && (
          <MetricBar label="Sessions" current={metrics.analytics.sessions} previous={metrics.analytics.previousSessions} />
        )}
      </div>
    </div>
  );
}
