"use client";

import { ClipboardPaste } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { ResetFormOnSuccess } from "@/components/contacts/ResetFormOnSuccess";
import { importContactsAction } from "@/app/app/contacts/actions";

export function ImportContactsForm() {
  return (
    <ActionForm action={importContactsAction} className="card space-y-4">
      {(state) => (
        <>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
              <ClipboardPaste className="h-5 w-5 text-brand-600" /> Add many at once
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Paste a list, one customer per line — from a spreadsheet, your phone contacts or a message. Up to 500 lines at a time.
            </p>
          </div>

          <div>
            <label htmlFor="import-list" className="mb-1 block text-sm font-medium text-ink-700">
              Your list
            </label>
            <textarea
              id="import-list"
              name="list"
              rows={6}
              className="field-input font-mono text-sm"
              placeholder={"Ravi Sharma, 98765 43210, vip\nAnita Rao, +91 90000 11111\nMeena - 91111 22222"}
            />
            <p className="mt-1 text-xs text-ink-500">Name and number (either order). Anything after them is used as tags.</p>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-ink-100 bg-ink-50 p-3 text-sm text-ink-800">
            <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 rounded border-ink-300" />
            <span>
              <span className="font-medium">Everyone in this list agreed to receive messages from my business.</span>
              <span className="mt-0.5 block text-xs text-ink-500">
                If you leave this empty they&apos;re still saved, but won&apos;t appear in message lists until you mark them as agreed.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton className="btn-primary px-5 py-2.5" pendingLabel="Adding…">
              Add these customers
            </SubmitButton>
          </div>
          {state.message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p>}
          <FormError message={state.error} />
          <ResetFormOnSuccess when={state.message} />
        </>
      )}
    </ActionForm>
  );
}
