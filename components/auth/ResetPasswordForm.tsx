"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { resetPasswordAction } from "@/app/reset-password/actions";

export function ResetPasswordForm() {
  return (
    <ActionForm action={resetPasswordAction} className="space-y-4">
      {(state) => (
        <>
          <FormError message={state.error} />
          <div>
            <label className="field-label" htmlFor="password">
              New password
            </label>
            <input
              className="field-input"
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              className="field-input"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <SubmitButton className="btn-primary w-full">Update Password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
