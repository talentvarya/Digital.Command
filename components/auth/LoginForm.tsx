"use client";

import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { loginAction } from "@/app/login/actions";

export function LoginForm() {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      {(state) => (
        <>
          <FormError message={state.error} />
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
              autoComplete="current-password"
            />
          </div>
          <SubmitButton className="btn-primary w-full">Log In</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
