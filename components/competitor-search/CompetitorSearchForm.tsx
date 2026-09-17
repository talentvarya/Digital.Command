"use client";

import { Search } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { runCompetitorSearchAction } from "@/app/app/competitor-search/actions";

const COUNTRIES = [
  { code: "in", label: "India" },
  { code: "us", label: "United States" },
  { code: "gb", label: "United Kingdom" },
  { code: "ae", label: "UAE" },
  { code: "au", label: "Australia" },
];

export function CompetitorSearchForm() {
  return (
    <ActionForm action={runCompetitorSearchAction} className="card space-y-3">
      {(state) => (
        <>
          <h2 className="text-lg font-semibold text-ink-900">Run a search</h2>
          <p className="text-sm text-ink-500">
            Try what a customer would actually type — e.g. &quot;chocolate shop pune&quot; or &quot;best gym near
            me&quot;. Digital Command checks the real Google results and, if your website is connected, where you
            rank among them.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1">
              <label className="field-label" htmlFor="query">
                Search term
              </label>
              <input className="field-input" id="query" name="query" placeholder="chocolate shop pune" required />
            </div>
            <div>
              <label className="field-label" htmlFor="countryCode">
                Country
              </label>
              <select className="field-input" id="countryCode" name="countryCode" defaultValue="in">
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
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
