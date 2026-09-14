"use client";

import { RefreshCw, Unplug } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import { selectGooglePropertyAction, disconnectGoogleServiceAction } from "@/app/app/seo/actions";
import { GOOGLE_SERVICE_LABELS } from "@/lib/constants/google";
import type { ActionResult } from "@/app/register/actions";
import type { GoogleConnectionPublic, GoogleService } from "@/types/database";

export function GoogleConnectionCard({
  service,
  connection,
  properties,
  syncAction,
}: {
  service: GoogleService;
  connection: GoogleConnectionPublic | null;
  properties: { id: string; label: string }[] | null;
  syncAction: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const status = connection?.status ?? "not_added";

  return (
    <div className="rounded-lg border border-ink-100 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-ink-900">{GOOGLE_SERVICE_LABELS[service]}</span>
        <StatusBadge status={status} />
      </div>

      {(status === "not_added" || status === "reconnect_required" || status === "error") && (
        <a href={`/api/google/oauth/start?service=${service}`} className="btn-primary inline-flex px-3 py-1.5 text-sm">
          {status === "not_added" ? "Connect" : "Reconnect"}
        </a>
      )}

      {status === "connected" && !connection?.external_property && (
        <ActionForm action={selectGooglePropertyAction} className="flex flex-wrap items-end gap-2">
          {(state) => (
            <>
              <input type="hidden" name="service" value={service} />
              <div className="flex-1">
                <label className="field-label">Choose a property</label>
                <select name="property" className="field-input" defaultValue="" required>
                  <option value="" disabled>
                    {properties && properties.length > 0 ? "Select…" : "No properties found on this Google account"}
                  </option>
                  {(properties ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton className="btn-primary px-3 py-2 text-sm">Save</SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}

      {status === "connected" && connection?.external_property && (
        <div className="space-y-2">
          <p className="text-xs text-ink-500">
            {connection.external_property}
            {connection.last_synced_at && ` · last synced ${new Date(connection.last_synced_at).toLocaleString()}`}
          </p>
          <div className="flex gap-2">
            <ActionForm action={syncAction}>
              {(state) => (
                <>
                  <SubmitButton className="btn-secondary px-3 py-1.5 text-sm" pendingLabel="Syncing…">
                    <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Sync Now
                  </SubmitButton>
                  <FormError message={state.error} />
                </>
              )}
            </ActionForm>
            <ActionForm action={disconnectGoogleServiceAction}>
              {() => (
                <>
                  <input type="hidden" name="service" value={service} />
                  <button type="submit" className="btn-secondary px-3 py-1.5 text-sm text-red-600">
                    <Unplug className="mr-1 inline h-3.5 w-3.5" /> Disconnect
                  </button>
                </>
              )}
            </ActionForm>
          </div>
        </div>
      )}
    </div>
  );
}
