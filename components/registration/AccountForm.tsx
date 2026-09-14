"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { signUpAction } from "@/app/register/actions";

export function AccountForm() {
  return (
    <ActionForm action={signUpAction} className="space-y-4">
      {(state) => (
        <>
          <FormError message={state.error} />
          <div>
            <label className="field-label" htmlFor="fullName">
              Your full name
            </label>
            <input className="field-input" id="fullName" name="fullName" required autoComplete="name" />
          </div>
          <div>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input className="field-input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="field-label" htmlFor="password">
              Password
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
          <SubmitButton className="btn-primary w-full">Continue</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
