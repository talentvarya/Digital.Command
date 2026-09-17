"use client";

import { CheckCircle2, AlertTriangle, XCircle, Sparkles, Copy, Check } from "lucide-react";
import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { runAeoAuditAction, draftFaqAction } from "@/app/app/ai-visibility/actions";
import type { AeoAudit, AeoFinding } from "@/types/database";

const STATUS_ICON: Record<AeoFinding["status"], typeof CheckCircle2> = {
  good: CheckCircle2,
  needs_work: AlertTriangle,
  missing: XCircle,
};

const STATUS_COLOR: Record<AeoFinding["status"], string> = {
  good: "text-emerald-600",
  needs_work: "text-amber-600",
  missing: "text-red-600",
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-current text-2xl font-bold ${color}`}>
      {score}
    </div>
  );
}

function CopyFaqButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API can be unavailable — copy button just won't confirm, not fatal
    }
  }
  return (
    <button type="button" onClick={copy} className="btn-secondary px-3 py-1.5 text-xs">
      {copied ? <Check className="mr-1 inline h-3 w-3" /> : <Copy className="mr-1 inline h-3 w-3" />}
      {copied ? "Copied" : "Copy FAQ text"}
    </button>
  );
}

export function AeoAuditPanel({ defaultUrl, latestAudit }: { defaultUrl: string; latestAudit: AeoAudit | null }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-900">AI Search Visibility Audit</h2>
        {latestAudit && (
          <span className="text-xs text-ink-400">Last run {new Date(latestAudit.audited_at).toLocaleString()}</span>
        )}
      </div>

      <ActionForm action={runAeoAuditAction} className="flex flex-wrap items-end gap-2">
        {(state) => (
          <>
            <div className="flex-1">
              <label className="field-label" htmlFor="aeo-url">
                Website URL
              </label>
              <input className="field-input" id="aeo-url" name="url" defaultValue={defaultUrl} placeholder="https://…" required />
            </div>
            <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Checking…">
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
            {latestAudit.findings.map((finding, i) => {
              const Icon = STATUS_ICON[finding.status];
              return (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${STATUS_COLOR[finding.status]}`} />
                  <span className="text-ink-700">{finding.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {latestAudit && !latestAudit.faq_draft && (
        <ActionForm action={draftFaqAction} className="border-t border-ink-50 pt-4">
          {(state) => (
            <>
              <input type="hidden" name="auditId" value={latestAudit.id} />
              <SubmitButton className="btn-secondary px-4 py-2 text-sm" pendingLabel="Drafting…">
                <Sparkles className="mr-1 inline h-3.5 w-3.5" /> Draft FAQ content for the gaps above
              </SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}

      {latestAudit?.faq_draft && (
        <div className="space-y-2 border-t border-ink-50 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">FAQ draft — add this to your website</h3>
            <CopyFaqButton text={latestAudit.faq_draft} />
          </div>
          <pre className="whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{latestAudit.faq_draft}</pre>
        </div>
      )}
    </div>
  );
}
