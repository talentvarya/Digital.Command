"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { logReviewAction } from "@/app/app/reputation/actions";

export function LogReviewForm() {
  return (
    <ActionForm action={logReviewAction} className="card space-y-3">
      {(state) => (
        <>
          <h2 className="text-lg font-semibold text-ink-900">Log a review you received</h2>
          <p className="text-sm text-ink-500">
            No live Google/Facebook feed yet — type in what a customer left, and Digital Command drafts your reply.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Platform</label>
              <select className="field-input" name="platform" defaultValue="google">
                <option value="google">Google</option>
                <option value="facebook">Facebook</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="field-label">Rating</label>
              <select className="field-input" name="rating" defaultValue="">
                <option value="">Not given</option>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {r} star{r === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Reviewer name (optional)</label>
              <input className="field-input" name="reviewerName" />
            </div>
            <div>
              <label className="field-label">Date (optional)</label>
              <input className="field-input" name="reviewDate" type="date" />
            </div>
          </div>
          <div>
            <label className="field-label">Review text</label>
            <textarea className="field-input" name="reviewText" rows={3} placeholder="Paste or type what they wrote…" />
          </div>
          <SubmitButton className="btn-primary px-4 py-2">Log review</SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
