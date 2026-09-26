"use client";

import { CalendarHeart, CheckCircle2, Sparkles } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { planOccasionPostAction } from "@/app/app/planner/actions";

export interface OccasionCardItem {
  key: string;
  name: string;
  hindi: string | null;
  dateLabel: string; // "Sun 8 Nov"
  daysLabel: string; // "in 12 days"
  angle: string;
  approximate: boolean;
  planned: { facebook: boolean; instagram: boolean };
}

const PLATFORMS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
] as const;

// Festivals and occasions coming up, each with a button that writes a draft for it.
// Only ever on a click — nothing is planned for a festival by itself — and the
// draft goes through the usual approval.
export function OccasionsCard({ occasions }: { occasions: OccasionCardItem[] }) {
  if (occasions.length === 0) return null;

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <CalendarHeart className="h-5 w-5 text-rose-600" /> Coming up
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Customers expect to hear from you on the big days. Press a button and Digital Command writes a draft for that day — you still approve it
          first.
        </p>
      </div>

      <ul className="divide-y divide-ink-100">
        {occasions.map((o) => (
          <li key={o.key} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="font-semibold text-ink-900">
                {o.name}
                {o.hindi && <span className="ml-2 font-normal text-ink-500">{o.hindi}</span>}
              </h3>
              <p className="text-sm text-ink-600">
                <span className="font-medium">{o.dateLabel}</span> · {o.daysLabel}
                {o.approximate && <span className="text-ink-400"> (can move by a day with the moon)</span>}
              </p>
            </div>
            <p className="mt-1 text-sm text-ink-500">{o.angle}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {PLATFORMS.map((p) =>
                o.planned[p.id] ? (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                  >
                    <CheckCircle2 className="h-4 w-4" /> {p.label} post planned
                  </span>
                ) : (
                  <ActionForm key={p.id} action={planOccasionPostAction} className="contents">
                    {(state) => (
                      <>
                        <input type="hidden" name="occasionKey" value={o.key} />
                        <input type="hidden" name="platform" value={p.id} />
                        <SubmitButton className="btn-secondary px-3.5 py-2 text-sm" pendingLabel="Writing…">
                          <Sparkles className="mr-1.5 h-4 w-4 text-brand-600" /> Plan a {p.label} post
                        </SubmitButton>
                        {state.error && (
                          <div className="basis-full">
                            <FormError message={state.error} />
                          </div>
                        )}
                        {state.message && <p className="basis-full text-sm font-medium text-emerald-700">{state.message}</p>}
                      </>
                    )}
                  </ActionForm>
                )
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
