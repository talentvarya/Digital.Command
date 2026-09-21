"use client";

import { BarChart3 } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { syncAllInsightsAction } from "@/app/app/planner/actions";

export function InsightsSummary({
  startDate,
  endDate,
  publishedCount,
  syncedCount,
  totals,
  lastSyncedAt,
}: {
  startDate: string;
  endDate: string;
  publishedCount: number;
  syncedCount: number;
  totals: { name: string; value: number }[];
  lastSyncedAt: string | null;
}) {
  return (
    <ActionForm action={syncAllInsightsAction} className="card space-y-2">
      {(state) => (
        <>
          <input type="hidden" name="startDate" value={startDate} />
          <input type="hidden" name="endDate" value={endDate} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <BarChart3 className="h-4 w-4 text-ink-400" /> Post insights
            </h2>
            <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingLabel="Refreshing…">
              Refresh all insights
            </SubmitButton>
          </div>
          <p className="text-xs text-ink-500">
            {publishedCount} published Facebook/Instagram post{publishedCount === 1 ? "" : "s"} in this view ·{" "}
            {syncedCount} with insights synced
            {lastSyncedAt ? ` · last refreshed ${new Date(lastSyncedAt).toLocaleString()}` : ""}.
          </p>
          {totals.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {totals.map((t) => (
                <span key={t.name} className="text-sm text-ink-700">
                  <strong className="[font-variant-numeric:tabular-nums]">{t.value}</strong>{" "}
                  <span className="text-ink-500">{t.name.replace(/_/g, " ")}</span>
                </span>
              ))}
            </div>
          )}
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
