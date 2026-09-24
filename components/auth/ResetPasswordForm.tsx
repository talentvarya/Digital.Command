"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { resetPasswordAction } from "@/app/reset-password/actions";
import { createClient } from "@/lib/supabase/client";
import { getResetStep, verifyAuthenticatorCode, type ResetStep } from "@/lib/auth/mfa-reset";

export function ResetPasswordForm() {
  // Created inside an effect/handler only, never during the server render pass.
  const supabaseRef = useRef<SupabaseClient | null>(null);
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }

  const [step, setStep] = useState<ResetStep | "loading">("loading");

  useEffect(() => {
    getResetStep(getSupabase())
      .then(setStep)
      // If the check itself fails, fall back to the plain form: Supabase still
      // enforces its rules and the form shows its own message.
      .catch(() => setStep("set_password"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (step === "loading") {
    return <p className="text-sm text-ink-500">Checking your reset link…</p>;
  }

  if (step === "expired") {
    return (
      <div className="space-y-4">
        <FormError message="This reset link has expired or was already used." />
        <Link href="/forgot-password" className="btn-primary block w-full text-center">
          Request a new link
        </Link>
      </div>
    );
  }

  if (step === "verify_code") {
    return <VerifyCodeStep getSupabase={getSupabase} onVerified={() => setStep("set_password")} />;
  }

  return <NewPasswordForm />;
}

function VerifyCodeStep({ getSupabase, onVerified }: { getSupabase: () => SupabaseClient; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    const result = await verifyAuthenticatorCode(getSupabase(), code);
    if (result.error) {
      setError(result.error);
      setVerifying(false);
      return;
    }
    onVerified();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-ink-500">
        This account is protected with two-factor authentication. Enter the 6-digit code from your authenticator app
        to continue.
      </p>
      <FormError message={error} />
      <div>
        <label className="field-label" htmlFor="code">
          6-digit code
        </label>
        <input
          id="code"
          className="field-input text-center tracking-widest"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={verifying || code.replace(/\s+/g, "").length < 6}>
        {verifying ? "Verifying…" : "Verify code"}
      </button>
      <p className="text-xs text-ink-400">Lost your authenticator app? Ask your Digital Command administrator to reset it.</p>
    </form>
  );
}

function NewPasswordForm() {
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
