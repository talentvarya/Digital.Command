"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export default function MfaSetupPage() {
  const router = useRouter();
  // Created lazily inside an effect/handler (never during the server render
  // pass of static generation, which would run before env vars from the
  // eventual .env.local are available at request time).
  const supabaseRef = useRef<SupabaseClient | null>(null);
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = getSupabase();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const alreadyVerified = factors?.totp?.some((f) => f.status === "verified");
      if (alreadyVerified) {
        router.replace("/admin/dashboard");
        return;
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError) {
        setError(enrollError.message);
      } else if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      }
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setVerifying(true);
    setError(null);
    const supabase = getSupabase();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? "Could not start MFA challenge");
      setVerifying(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError(verifyError.message);
      setVerifying(false);
      return;
    }

    router.replace("/admin/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md py-8">
      <div className="card">
        <div className="mb-4 flex items-center gap-2 text-brand-700">
          <ShieldCheck className="h-5 w-5" />
          <h1 className="text-lg font-bold">Set up two-factor authentication</h1>
        </div>
        <p className="mb-6 text-sm text-ink-500">
          Super Admin accounts require MFA. Scan the QR code with an authenticator app (Google Authenticator, Authy,
          1Password) and enter the 6-digit code to finish setup.
        </p>

        {loading && <p className="text-sm text-ink-500">Preparing your authenticator setup…</p>}

        {!loading && qrCode && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- qrCode is a data: URI from Supabase, not a static asset */}
            <img src={qrCode} alt="Two-factor authentication QR code" className="mx-auto mb-4 h-48 w-48" />
            {secret && (
              <p className="mb-4 break-all rounded bg-ink-50 px-3 py-2 text-center text-xs text-ink-500">
                Can&apos;t scan? Enter this key manually: <span className="font-mono">{secret}</span>
              </p>
            )}
            <form onSubmit={handleVerify} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div>
                <label className="field-label" htmlFor="code">
                  6-digit code
                </label>
                <input
                  id="code"
                  className="field-input text-center tracking-widest"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={verifying || code.length < 6}>
                {verifying ? "Verifying…" : "Verify & Continue"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
