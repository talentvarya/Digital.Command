"use client";

import { ExternalLink, Search } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { searchBrandMentionsAction, addOpportunityAction } from "@/app/app/outreach/actions";
import type { BrandMentionSearch } from "@/types/database";

export function BrandMentionsPanel({ defaultQuery, latestSearch }: { defaultQuery: string; latestSearch: BrandMentionSearch | null }) {
  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Brand Mentions</h2>
        <p className="text-sm text-ink-500">
          Search the web for your business name to find unlinked mentions worth asking for a link (spec §9.2).
        </p>
      </div>

      <ActionForm action={searchBrandMentionsAction} className="flex flex-wrap items-end gap-2">
        {(state) => (
          <>
            <div className="flex-1">
              <label className="field-label">Search term</label>
              <input className="field-input" name="query" defaultValue={defaultQuery} required />
            </div>
            <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Searching…">
              <Search className="mr-1 inline h-4 w-4" /> Search
            </SubmitButton>
            <FormError message={state.error} />
          </>
        )}
      </ActionForm>

      {latestSearch && (
        <div className="space-y-2 border-t border-ink-50 pt-3">
          <p className="text-xs text-ink-400">
            Results for &quot;{latestSearch.query}&quot; — {new Date(latestSearch.searched_at).toLocaleString()}
          </p>
          {latestSearch.results.length === 0 && <p className="text-sm text-ink-400">No results found.</p>}
          {latestSearch.results.map((result) => (
            <div key={result.link} className="rounded-lg border border-ink-100 p-3">
              <a
                href={result.link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
              >
                {result.title}
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="mb-2 text-xs text-ink-500">{result.snippet}</p>
              <ActionForm action={addOpportunityAction}>
                {(state) => (
                  <>
                    <input type="hidden" name="url" value={result.link} />
                    <input type="hidden" name="opportunityType" value="unlinked_mention" />
                    <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingLabel="Adding…">
                      Turn into Opportunity
                    </SubmitButton>
                    <FormError message={state.error} />
                  </>
                )}
              </ActionForm>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
