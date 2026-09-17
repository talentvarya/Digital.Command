"use client";

import { Plug, Unplug } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import { saveApifyTokenAction, disconnectApifyAction } from "@/app/app/competitor-search/actions";
import type { ApifyConnectionPublic } from "@/types/database";

export function ApifyConnectionForm({ connection }: { connection: ApifyConnectionPublic | null }) {
  const isConnected = connection?.status === "connected";

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-900">Your Apify account</h2>
        <StatusBadge status={connection?.status ?? "not_added"} />
      </div>
      <p className="text-sm text-ink-500">
        This connects your own Apify account (apify.com) — searches run and are billed on your account, not Digital
        Command&apos;s. Create a free account, copy your API token from Settings → Integrations, and paste it below.
        Each search costs roughly $0.08 in Apify credits (up to 20 businesses per search).
      </p>

      {isConnected ? (
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-400">
            Connected {connection?.connected_at ? new Date(connection.connected_at).toLocaleDateString() : ""}
            {connection?.last_used_at ? ` · Last used ${new Date(connection.last_used_at).toLocaleString()}` : ""}
          </span>
          <ActionForm action={disconnectApifyAction}>
            {() => (
              <button type="submit" className="flex items-center gap-1 text-xs text-red-600 hover:underline">
                <Unplug className="h-3 w-3" /> Disconnect
              </button>
            )}
          </ActionForm>
        </div>
      ) : (
        <ActionForm action={saveApifyTokenAction} className="flex flex-wrap items-end gap-2">
          {(state) => (
            <>
              <div className="flex-1">
                <label className="field-label" htmlFor="apiToken">
                  Apify API token
                </label>
                <input className="field-input" id="apiToken" name="apiToken" type="password" placeholder="apify_api_…" required />
              </div>
              <SubmitButton className="btn-primary px-4 py-2 text-sm" pendingLabel="Connecting…">
                <Plug className="mr-1 inline h-3.5 w-3.5" /> Connect
              </SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}
