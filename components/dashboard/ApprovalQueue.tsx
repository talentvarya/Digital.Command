"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { decideContentAction } from "@/app/app/planner/actions";

export interface QueueItem {
  id: string;
  platform: string;
  slot: string;
  caption: string;
  imageUrl: string | null;
}

// Posts waiting for the client's yes, with the approve button right here so the
// most common job doesn't need a trip to the planner. Approving does exactly what
// it does in the planner (it schedules the post and sends it if a channel is linked).
export function ApprovalQueue({ items, total }: { items: QueueItem[]; total: number }) {
  return (
    <section id="approvals" className="card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink-900">Ready for your approval</h2>
        <Link href="/app/planner" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          {total > items.length ? `See all ${total} in the planner` : "Open the planner"}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="divide-y divide-ink-100">
        {items.map((item) => (
          <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg border border-ink-100 object-cover sm:h-24 sm:w-24" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-ink-200 bg-ink-50 px-1 text-center text-[11px] leading-tight text-ink-400 sm:h-24 sm:w-24">
                No image yet
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500">
                <span className="rounded-full bg-ink-100 px-2 py-0.5 font-medium text-ink-700">{item.platform}</span>
                <span>{item.slot}</span>
              </div>
              <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-ink-800">{item.caption}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ActionForm action={decideContentAction} className="contents">
                  {(state) => (
                    <>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Approving…">
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
                      </SubmitButton>
                      {state.error && <FormError message={state.error} />}
                    </>
                  )}
                </ActionForm>
                <Link href="/app/planner" className="btn-secondary px-4 py-2">
                  Edit or review
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
