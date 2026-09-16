"use client";

import { useState } from "react";
import { Star, Sparkles, Copy, Check } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import { draftReviewReplyAction, markReplyPostedAction } from "@/app/app/reputation/actions";
import type { Review } from "@/types/database";

const PLATFORM_LABELS: Record<string, string> = { google: "Google", facebook: "Facebook", other: "Other" };

export function ReviewCard({ review }: { review: Review }) {
  const [copied, setCopied] = useState(false);

  async function copyDraft() {
    if (!review.ai_reply_draft) return;
    try {
      await navigator.clipboard.writeText(review.ai_reply_draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API can be unavailable — copy button just won't confirm, not fatal
    }
  }

  return (
    <div className="rounded-lg border border-ink-100 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase text-ink-400">{PLATFORM_LABELS[review.platform]}</span>
        {review.rating !== null && (
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating! ? "fill-amber-400 text-amber-400" : "text-ink-200"}`} />
            ))}
          </span>
        )}
        <StatusBadge status={review.reply_status} />
        {review.review_date && <span className="text-xs text-ink-400">{review.review_date}</span>}
      </div>

      {review.reviewer_name && <p className="text-sm font-medium text-ink-800">{review.reviewer_name}</p>}
      {review.review_text && <p className="mt-1 text-sm text-ink-600">{review.review_text}</p>}

      {review.reply_status === "needs_reply" && (
        <ActionForm action={draftReviewReplyAction} className="mt-3 border-t border-ink-50 pt-3">
          {(state) => (
            <>
              <input type="hidden" name="reviewId" value={review.id} />
              <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingLabel="Drafting…">
                <Sparkles className="mr-1 inline h-3 w-3" /> Draft AI reply
              </SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}

      {review.ai_reply_draft && review.reply_status !== "needs_reply" && (
        <div className="mt-3 space-y-2 border-t border-ink-50 pt-3">
          <div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{review.ai_reply_draft}</div>
          {review.reply_status === "drafted" && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={copyDraft} className="btn-secondary px-3 py-1.5 text-xs">
                {copied ? <Check className="mr-1 inline h-3 w-3" /> : <Copy className="mr-1 inline h-3 w-3" />}
                {copied ? "Copied" : "Copy reply"}
              </button>
              <ActionForm action={markReplyPostedAction}>
                {() => (
                  <>
                    <input type="hidden" name="reviewId" value={review.id} />
                    <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
                      Mark posted
                    </button>
                  </>
                )}
              </ActionForm>
            </div>
          )}
          {review.reply_status === "posted" && review.replied_at && (
            <p className="text-xs text-ink-400">Posted {new Date(review.replied_at).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}
