"use client";

import { UserPlus } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { ResetFormOnSuccess } from "@/components/contacts/ResetFormOnSuccess";
import { addContactAction } from "@/app/app/contacts/actions";

export function AddContactForm() {
  return (
    <ActionForm action={addContactAction} className="card space-y-4">
      {(state) => (
        <>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
            <UserPlus className="h-5 w-5 text-brand-600" /> Add a customer
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className="mb-1 block text-sm font-medium text-ink-700">
                Name
              </label>
              <input id="contact-name" name="name" required maxLength={80} className="field-input" placeholder="Ravi Sharma" autoComplete="off" />
            </div>
            <div>
              <label htmlFor="contact-phone" className="mb-1 block text-sm font-medium text-ink-700">
                WhatsApp number
              </label>
              <input
                id="contact-phone"
                name="phone"
                type="tel"
                required
                inputMode="tel"
                className="field-input"
                placeholder="98765 43210"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-ink-500">For a number outside India, start with + and the country code, like +971 50 123 4567.</p>
            </div>
            <div>
              <label htmlFor="contact-tags" className="mb-1 block text-sm font-medium text-ink-700">
                Tags <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <input id="contact-tags" name="tags" className="field-input" placeholder="vip, wedding" autoComplete="off" />
            </div>
            <div>
              <label htmlFor="contact-notes" className="mb-1 block text-sm font-medium text-ink-700">
                Note <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <input id="contact-notes" name="notes" maxLength={300} className="field-input" placeholder="Likes dark chocolate" autoComplete="off" />
            </div>
          </div>

          <div className="rounded-lg border border-ink-100 bg-ink-50 p-3">
            <label className="flex items-start gap-2.5 text-sm text-ink-800">
              <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 rounded border-ink-300" />
              <span>
                <span className="font-medium">This customer agreed to receive messages from my business.</span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  Only tick this for people who said yes — in the shop, on a call, or on WhatsApp. Customers who haven&apos;t agreed
                  are saved but never appear in message lists.
                </span>
              </span>
            </label>
            <input
              name="consentNote"
              maxLength={120}
              aria-label="How did they agree? (optional)"
              className="field-input mt-2.5"
              placeholder="How did they agree? (optional) — e.g. asked in the shop"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton className="btn-primary px-5 py-2.5" pendingLabel="Adding…">
              Add customer
            </SubmitButton>
            {state.message && <p className="text-sm font-medium text-emerald-700">{state.message}</p>}
          </div>
          <FormError message={state.error} />
          <ResetFormOnSuccess when={state.message} />
        </>
      )}
    </ActionForm>
  );
}
