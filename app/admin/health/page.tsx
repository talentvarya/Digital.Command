import { CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cronHealth, getConfigChecks, missingRequired, type CronHealth } from "@/lib/admin/config-checks";

const CRON_JOBS = [{ job: "planner-fill", label: "Autopilot planner fill (nightly)" }];

const CRON_STYLE: Record<CronHealth, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  healthy: { label: "Healthy", className: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
  failed: { label: "Last run failed", className: "bg-red-100 text-red-800", Icon: XCircle },
  stale: { label: "Overdue", className: "bg-amber-100 text-amber-800", Icon: AlertTriangle },
  never_run: { label: "Never run", className: "bg-slate-200 text-slate-800", Icon: Clock },
};

export default async function AdminConfigHealthPage() {
  const supabase = createClient();
  const checks = getConfigChecks(process.env);
  const required = checks.filter((c) => c.required);
  const optional = checks.filter((c) => !c.required);
  const problems = missingRequired(checks);

  const runs = await Promise.all(
    CRON_JOBS.map(async ({ job, label }) => {
      const { data, error } = await supabase
        .from("cron_runs")
        .select("ran_at, ok, error, summary")
        .eq("job", job)
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { job, label, last: data, tableMissing: Boolean(error) };
    })
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Config Health</h1>
        <p className="text-sm text-ink-500">
          Whether the deployment is set up correctly. Only presence is checked — no value is ever shown. A setting
          added or changed in Vercel takes effect after the next deploy.
        </p>
      </div>

      {problems.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {problems.length} required setting{problems.length > 1 ? "s are" : " is"} missing — parts of the app are
          broken right now.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Every required setting is present.
        </div>
      )}

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold text-ink-900">Required</h2>
        {required.map((c) => (
          <CheckRow key={c.key} check={c} />
        ))}
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold text-ink-900">Optional features</h2>
        {optional.map((c) => (
          <CheckRow key={c.key} check={c} />
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold text-ink-900">Scheduled jobs</h2>
        {runs.map(({ job, label, last, tableMissing }) => {
          const health = cronHealth(last ? { ran_at: last.ran_at, ok: last.ok } : null);
          const { label: badge, className, Icon } = CRON_STYLE[health];
          return (
            <div key={job} className="space-y-1 border-b border-ink-50 pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink-800">{label}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
                  <Icon className="h-3 w-3" /> {badge}
                </span>
              </div>
              {last && <p className="text-xs text-ink-500">Last run {new Date(last.ran_at).toLocaleString()}</p>}
              {last?.error && <p className="text-xs text-red-700">{last.error}</p>}
              {tableMissing && (
                <p className="text-xs text-amber-700">
                  Run log isn&apos;t available yet — apply migration 0035_cron_runs.sql in the Supabase SQL Editor.
                </p>
              )}
              {!tableMissing && !last && (
                <p className="text-xs text-ink-500">No run recorded yet — it appears after the next scheduled run.</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function CheckRow({ check }: { check: ReturnType<typeof getConfigChecks>[number] }) {
  return (
    <div className="flex items-start gap-3 border-b border-ink-50 py-2 last:border-0">
      {check.set ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className={`mt-0.5 h-4 w-4 shrink-0 ${check.required ? "text-red-600" : "text-amber-500"}`} />
      )}
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink-800">{check.label}</div>
        <div className="truncate font-mono text-[11px] text-ink-400">{check.key}</div>
        {!check.set && <div className="mt-0.5 text-xs text-ink-600">If missing: {check.ifMissing}</div>}
      </div>
    </div>
  );
}
