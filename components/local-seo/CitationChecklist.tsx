"use client";

import { Check } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { toggleCitationAction } from "@/app/app/local-seo/actions";
import { LOCAL_CITATION_DIRECTORIES } from "@/lib/constants/local-seo";

export function CitationChecklist({ completed }: { completed: string[] }) {
  return (
    <div className="card space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Citation checklist</h2>
        <p className="text-sm text-ink-500">
          Mark the directories where you&apos;re already listed — being listed consistently across these is what
          builds local search trust. Digital Command doesn&apos;t create these listings for you; each link opens the
          site so you can add or check yours.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {LOCAL_CITATION_DIRECTORIES.map((dir) => {
          const done = completed.includes(dir.name);
          return (
            <div
              key={dir.name}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                done ? "border-emerald-200 bg-emerald-50" : "border-ink-100"
              }`}
            >
              <a href={dir.url} target="_blank" rel="noreferrer" className="text-ink-700 hover:underline">
                {dir.name}
              </a>
              <ActionForm action={toggleCitationAction}>
                {() => (
                  <>
                    <input type="hidden" name="directory" value={dir.name} />
                    <button
                      type="submit"
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        done ? "border-emerald-500 bg-emerald-500 text-white" : "border-ink-300 text-transparent"
                      }`}
                      aria-label={done ? `Mark ${dir.name} not listed` : `Mark ${dir.name} listed`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </ActionForm>
            </div>
          );
        })}
      </div>
    </div>
  );
}
