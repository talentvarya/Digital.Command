"use client";

import { FlaskConical } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { StatusBadge } from "@/components/StatusBadge";
import { setSandboxAction } from "@/app/admin/clients/[orgId]/actions";

export function SandboxToggle({ orgId, isSandbox }: { orgId: string; isSandbox: boolean }) {
  return (
    <ActionForm action={setSandboxAction} className="inline-flex items-center gap-2">
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="isSandbox" value={String(!isSandbox)} />
          {isSandbox && <StatusBadge status="sandbox" />}
          <button type="submit" className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-700">
            <FlaskConical className="h-3 w-3" /> {isSandbox ? "Unmark sandbox" : "Mark as sandbox"}
          </button>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
