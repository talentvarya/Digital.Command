"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { saveReviewLinksAction } from "@/app/app/reputation/actions";

export function ReviewLinksForm({
  googleReviewLink,
  facebookReviewLink,
}: {
  googleReviewLink: string | null;
  facebookReviewLink: string | null;
}) {
  return (
    <ActionForm action={saveReviewLinksAction} className="card space-y-3">
      {(state) => (
        <>
          <h2 className="text-lg font-semibold text-ink-900">Your review links</h2>
          <p className="text-sm text-ink-500">
            Get these from your own Google Business Profile (&quot;Ask for reviews&quot; link) and Facebook Page
            (&quot;Reviews&quot; tab share link) — customers get sent straight here.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Google review link</label>
              <input className="field-input" name="googleReviewLink" defaultValue={googleReviewLink ?? ""} placeholder="https://g.page/r/…/review" />
            </div>
            <div>
              <label className="field-label">Facebook review link</label>
              <input className="field-input" name="facebookReviewLink" defaultValue={facebookReviewLink ?? ""} placeholder="https://facebook.com/…/reviews" />
            </div>
          </div>
          <SubmitButton className="btn-secondary px-4 py-2 text-sm">Save links</SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
