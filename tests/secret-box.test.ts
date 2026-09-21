import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, isEncrypted, tryDecryptSecret } from "@/lib/security/secret-box";

const KEY = "a-long-random-secret-from-openssl";

afterEach(() => vi.unstubAllEnvs());

describe("secret box", () => {
  it("round-trips a token", () => {
    const stored = encryptSecret("apify_api_ABC123", KEY);
    expect(stored).not.toContain("apify_api_ABC123");
    expect(isEncrypted(stored)).toBe(true);
    expect(decryptSecret(stored, KEY)).toBe("apify_api_ABC123");
  });

  it("uses a fresh IV each time, so the same token never encrypts the same way twice", () => {
    expect(encryptSecret("same", KEY)).not.toBe(encryptSecret("same", KEY));
  });

  it("handles long and non-ASCII values", () => {
    const long = "ya29." + "x".repeat(2000) + "—€";
    expect(decryptSecret(encryptSecret(long, KEY), KEY)).toBe(long);
  });

  it("stores plain text unchanged when no key is configured (so enabling it later can't break anything)", () => {
    expect(encryptSecret("plain-token", undefined)).toBe("plain-token");
    expect(encryptSecret("plain-token", "   ")).toBe("plain-token");
  });

  it("returns legacy plain-text values untouched, key or no key", () => {
    expect(decryptSecret("legacy-plain-token", KEY)).toBe("legacy-plain-token");
    expect(decryptSecret("legacy-plain-token", undefined)).toBe("legacy-plain-token");
  });

  it("fails loudly with the wrong key", () => {
    const stored = encryptSecret("secret", KEY);
    expect(() => decryptSecret(stored, "a-different-key")).toThrow("could not be decrypted");
  });

  it("detects tampering", () => {
    const stored = encryptSecret("secret", KEY);
    const flipped = stored.slice(0, -4) + (stored.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decryptSecret(flipped, KEY)).toThrow("could not be decrypted");
  });

  it("says so plainly when a value is encrypted but the deployment has no key", () => {
    const stored = encryptSecret("secret", KEY);
    expect(() => decryptSecret(stored, undefined)).toThrow("TOKEN_ENCRYPTION_KEY is not set");
  });

  it("reads TOKEN_ENCRYPTION_KEY from the environment by default", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", KEY);
    expect(decryptSecret(encryptSecret("env-secret"))).toBe("env-secret");
  });
});

describe("tryDecryptSecret", () => {
  it("returns null instead of throwing for an undecryptable value, and for empty input", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "some-key");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(tryDecryptSecret(encryptSecret("x", "other-key"))).toBeNull();
    expect(tryDecryptSecret(null)).toBeNull();
    expect(tryDecryptSecret("")).toBeNull();
    errorSpy.mockRestore();
  });

  it("decrypts a good value", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", KEY);
    expect(tryDecryptSecret(encryptSecret("good"))).toBe("good");
  });
});
