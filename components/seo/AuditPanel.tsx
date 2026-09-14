"use client";

import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { runAuditAction } from "@/app/app/seo/actions";
import type { SeoAudit, SeoIssue } from "@/types/database";

const SEVERITY_ICON: Record<SeoIssue["severity"], typeof AlertCircle> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOR: Record<SeoIssue["severity"], string> = {
  critical: "text-red-600",
  warning: "text-amber-600",
  info: "text-ink-400",
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-current text-2xl font-bold ${color}`}>
      {score}
    </div>
  );
}

export function AuditPanel({ defaultUrl, latestAudit }: { defaultUrl: string; latestAudit: SeoAudit | null }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-900">Technical SEO Audit</h2>
        {latestAudit && (
          <span className="text-xs text-ink-400">Last run {new Date(latestAudit.crawled_at).toLocaleString()}</span>
        )}
      </div>

      <ActionForm action={runAuditAction} className="flex flex-wrap items-end gap-2">
        {(state) => (
          <>
            <div className="flex-1">
              <label className="field-label" htmlFor="url">
                Website URL
              </label>
              <input className="field-input" id="url" name="url" defaultValue={defaultUrl} placeholder="https://…" required />
            </div>
            <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Auditing…">
              Run Audit
            </SubmitButton>
            <FormError message={state.error} />
          </>
        )}
      </ActionForm>

      {latestAudit && (
        <div className="flex flex-col gap-4 border-t border-ink-50 pt-4 sm:flex-row">
          <ScoreRing score={latestAudit.score} />
          <div className="flex-1 space-y-2">
            {latestAudit.issues.length === 0 && <p className="text-sm text-emerald-700">No issues found.</p>}
            {latestAudit.issues.map((issue, i) => {
              const Icon = SEVERITY_ICON[issue.severity];
              return (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[issue.severity]}`} />
                  <span className="text-ink-700">{issue.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
