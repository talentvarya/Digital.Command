"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState } from "react-dom";
import { Logo } from "@/components/Logo";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState(forgotPasswordAction, {});
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card">
          <h1 className="mb-2 text-xl font-bold text-ink-900">Reset your password</h1>
          <p className="mb-6 text-sm text-ink-500">
            Enter your account email and we&apos;ll send you a password reset link.
          </p>
          {submitted ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              If an account exists for that email, a reset link is on its way.
            </p>
          ) : (
            <form action={formAction} onSubmit={() => setSubmitted(true)} className="space-y-4">
              <FormError message={state.error} />
              <div>
                <label className="field-label" htmlFor="email">Email</label>
                <input className="field-input" id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <SubmitButton className="btn-primary w-full">Send Reset Link</SubmitButton>
            </form>
          )}
          <div className="mt-4 text-sm">
            <Link href="/login" className="text-brand-600 hover:underline">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
