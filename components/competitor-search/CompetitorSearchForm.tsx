"use client";

import { Search } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { runCompetitorSearchAction } from "@/app/app/competitor-search/actions";

export function CompetitorSearchForm() {
  return (
    <ActionForm action={runCompetitorSearchAction} className="card space-y-3">
      {(state) => (
        <>
          <h2 className="text-lg font-semibold text-ink-900">Run a search</h2>
          <p className="text-sm text-ink-500">
            Try what a customer would actually type into Google Maps — e.g. &quot;chocolate shop&quot; or &quot;best
            gym&quot; — plus the area to search in. Digital Command checks the real map results and, if your website
            is connected, where you rank among them.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1">
              <label className="field-label" htmlFor="query">
                Search term
              </label>
              <input className="field-input" id="query" name="query" placeholder="chocolate shop" required />
            </div>
            <div className="flex-1">
              <label className="field-label" htmlFor="location">
                Location
              </label>
              <input className="field-input" id="location" name="location" placeholder="Pune, India" required />
            </div>
            <SubmitButton className="btn-primary px-4 py-2 text-sm" pendingLabel="Searching…">
              <Search className="mr-1 inline h-3.5 w-3.5" /> Search
            </SubmitButton>
          </div>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
