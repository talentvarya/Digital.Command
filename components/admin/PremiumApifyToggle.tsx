"use client";

import { Zap } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { setPremiumApifyAction } from "@/app/admin/clients/[orgId]/actions";

export function PremiumApifyToggle({ orgId, enabled }: { orgId: string; enabled: boolean }) {
  return (
    <ActionForm action={setPremiumApifyAction} className="flex items-center gap-2">
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="enabled" value={String(!enabled)} />
          <Zap className={`h-3.5 w-3.5 ${enabled ? "text-amber-500" : "text-ink-300"}`} />
          <span className="text-sm text-ink-700">Premium: Competitor Search (Apify)</span>
          <button
            type="submit"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              enabled ? "bg-emerald-100 text-emerald-800" : "bg-ink-100 text-ink-600"
            }`}
          >
            {enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
          </button>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
