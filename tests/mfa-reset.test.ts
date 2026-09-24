import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getResetStep, verifyAuthenticatorCode } from "@/lib/auth/mfa-reset";

// A stand-in for the few Supabase Auth calls these helpers make.
function fakeClient(opts: {
  session?: object | null;
  currentLevel?: string | null; // null = the assurance level can't be read
  factors?: { id: string; status: string }[];
  listError?: { message: string; status?: number };
  challengeError?: string;
  verifyError?: string;
}) {
  const challenge = vi.fn(async () =>
    opts.challengeError ? { data: null, error: { message: opts.challengeError } } : { data: { id: "challenge-1" }, error: null }
  );
  const verify = vi.fn(async () => (opts.verifyError ? { data: null, error: { message: opts.verifyError } } : { data: {}, error: null }));
  const client = {
    auth: {
      getSession: async () => ({ data: { session: opts.session === undefined ? { access_token: "t" } : opts.session } }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: opts.currentLevel === null ? null : { currentLevel: opts.currentLevel ?? "aal1" },
          error: null,
        }),
        listFactors: async () =>
          opts.listError ? { data: null, error: opts.listError } : { data: { totp: opts.factors ?? [] }, error: null },
        challenge,
        verify,
      },
    },
  } as unknown as SupabaseClient;
  return { client, challenge, verify };
}

const verified = [{ id: "f", status: "verified" }];

describe("getResetStep", () => {
  it("says the link has expired when there is no reset session", async () => {
    const { client } = fakeClient({ session: null });
    expect(await getResetStep(client)).toBe("expired");
  });

  it("goes straight to the new-password form when the account has no authenticator", async () => {
    const { client } = fakeClient({ factors: [] });
    expect(await getResetStep(client)).toBe("set_password");
  });

  it("ignores an authenticator whose setup was never finished", async () => {
    const { client } = fakeClient({ factors: [{ id: "f", status: "unverified" }] });
    expect(await getResetStep(client)).toBe("set_password");
  });

  it("asks for an authenticator code when the account has one but the session is only level 1", async () => {
    const { client } = fakeClient({ factors: verified, currentLevel: "aal1" });
    expect(await getResetStep(client)).toBe("verify_code");
  });

  it("does not ask again once the session is already level 2", async () => {
    const { client } = fakeClient({ factors: verified, currentLevel: "aal2" });
    expect(await getResetStep(client)).toBe("set_password");
  });

  it("asks for a code (harmless if unneeded) when the level can't be read", async () => {
    const { client } = fakeClient({ factors: verified, currentLevel: null });
    expect(await getResetStep(client)).toBe("verify_code");
  });

  it("says the link has expired when the server rejects the session", async () => {
    expect(await getResetStep(fakeClient({ listError: { message: "session not found", status: 403 } }).client)).toBe("expired");
    expect(await getResetStep(fakeClient({ listError: { message: "invalid JWT", status: 401 } }).client)).toBe("expired");
  });

  it("falls back to the plain form on any other failure (Supabase still enforces its rules)", async () => {
    const { client } = fakeClient({ listError: { message: "network down" } });
    expect(await getResetStep(client)).toBe("set_password");
  });
});

describe("verifyAuthenticatorCode", () => {
  it("challenges the VERIFIED authenticator and sends the code without spaces", async () => {
    const { client, challenge, verify } = fakeClient({
      factors: [
        { id: "half-finished-setup", status: "unverified" },
        { id: "the-real-one", status: "verified" },
      ],
    });
    expect(await verifyAuthenticatorCode(client, "123 456")).toEqual({});
    expect(challenge).toHaveBeenCalledWith({ factorId: "the-real-one" });
    expect(verify).toHaveBeenCalledWith({ factorId: "the-real-one", challengeId: "challenge-1", code: "123456" });
  });

  it("reports when the account has no verified authenticator, without calling Supabase further", async () => {
    const { client, challenge, verify } = fakeClient({ factors: [{ id: "x", status: "unverified" }] });
    expect(await verifyAuthenticatorCode(client, "123456")).toEqual({ error: "No authenticator app is set up on this account." });
    expect(challenge).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("passes on Supabase's message for a wrong code", async () => {
    const { client } = fakeClient({ factors: verified, verifyError: "Invalid TOTP code entered" });
    expect(await verifyAuthenticatorCode(client, "000000")).toEqual({ error: "Invalid TOTP code entered" });
  });

  it("stops if the factor list or the challenge can't be fetched", async () => {
    const listFail = fakeClient({ listError: { message: "network down" } });
    expect(await verifyAuthenticatorCode(listFail.client, "123456")).toEqual({ error: "network down" });

    const challengeFail = fakeClient({ factors: verified, challengeError: "too many attempts" });
    expect(await verifyAuthenticatorCode(challengeFail.client, "123456")).toEqual({ error: "too many attempts" });
    expect(challengeFail.verify).not.toHaveBeenCalled();
  });
});
