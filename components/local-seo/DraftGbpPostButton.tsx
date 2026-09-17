"use client";

import { Sparkles } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { draftGbpPostAction } from "@/app/app/local-seo/actions";

export function DraftGbpPostButton() {
  return (
    <ActionForm action={draftGbpPostAction}>
      {(state) => (
        <>
          <SubmitButton className="btn-primary px-4 py-2 text-sm" pendingLabel="Drafting…">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" /> Draft a Google Post
          </SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
