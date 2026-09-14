"use client";

import { useState } from "react";
import { ExternalLink, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import { updateLinkAction, removeLinkAction, checkLinkHealthAction } from "@/app/app/links/actions";
import { LINK_TYPE_LABELS, OAUTH_LINK_TYPES } from "@/lib/constants/content";
import type { OrgLink } from "@/types/database";

export function LinkRow({ link }: { link: OrgLink }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="border-b border-ink-50 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink-900">{LINK_TYPE_LABELS[link.link_type]}</span>
            <StatusBadge status={link.status} />
            {OAUTH_LINK_TYPES.includes(link.link_type) && (
              <span className="text-xs text-ink-400">(full account connection: Phase 4)</span>
            )}
          </div>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            {link.label || link.url}
            <ExternalLink className="h-3 w-3" />
          </a>
          {link.last_check_result && (
            <div className="text-xs text-ink-400">
              Last checked {link.last_checked_at ? new Date(link.last_checked_at).toLocaleString() : ""} —{" "}
              {link.last_check_result}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ActionForm action={checkLinkHealthAction}>
            {(state) => (
              <>
                <input type="hidden" name="id" value={link.id} />
                <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingLabel="Checking…">
                  <RefreshCw className="mr-1 h-3 w-3" /> Check
                </SubmitButton>
                <FormError message={state.error} />
              </>
            )}
          </ActionForm>
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setEditing((v) => !v)}>
            <Pencil className="mr-1 h-3 w-3 inline" /> Edit
          </button>
          <ActionForm action={removeLinkAction}>
            {(state) => (
              <>
                <input type="hidden" name="id" value={link.id} />
                <SubmitButton className="btn-danger px-3 py-1.5 text-xs">
                  <Trash2 className="mr-1 h-3 w-3 inline" /> Remove
                </SubmitButton>
                <FormError message={state.error} />
              </>
            )}
          </ActionForm>
        </div>
      </div>

      {editing && (
        <ActionForm action={updateLinkAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-ink-50 p-3">
          {(state) => (
            <>
              <input type="hidden" name="id" value={link.id} />
              <div className="flex-1">
                <label className="field-label">URL</label>
                <input className="field-input" name="url" defaultValue={link.url} required />
              </div>
              <div className="flex-1">
                <label className="field-label">Label (optional)</label>
                <input className="field-input" name="label" defaultValue={link.label ?? ""} />
              </div>
              <SubmitButton className="btn-primary px-3 py-2 text-sm">Save</SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}
