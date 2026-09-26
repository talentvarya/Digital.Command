import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareImageError, cloudflareImageConfigured, generateFluxImage } from "@/lib/creative/cloudflare";

const mockedFetch = vi.fn();

beforeEach(() => {
  mockedFetch.mockReset();
  vi.stubGlobal("fetch", mockedFetch);
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct-123");
  vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "tok-secret");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// A few real JPEG magic bytes, base64-encoded.
const IMAGE_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");

describe("cloudflareImageConfigured", () => {
  it("needs both the account id and the token", () => {
    expect(cloudflareImageConfigured({ CLOUDFLARE_ACCOUNT_ID: "a", CLOUDFLARE_AI_API_TOKEN: "t" })).toBe(true);
    expect(cloudflareImageConfigured({ CLOUDFLARE_ACCOUNT_ID: "a" })).toBe(false);
    expect(cloudflareImageConfigured({ CLOUDFLARE_ACCOUNT_ID: "  ", CLOUDFLARE_AI_API_TOKEN: "t" })).toBe(false);
    expect(cloudflareImageConfigured({})).toBe(false);
  });
});

describe("generateFluxImage", () => {
  it("calls the FLUX model with the token and returns the decoded image bytes", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, result: { image: IMAGE_B64 } }));

    const bytes = await generateFluxImage("a bar of chocolate");

    expect(Array.from(bytes)).toEqual([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct-123/ai/run/@cf/black-forest-labs/flux-1-schnell");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok-secret");
    expect(JSON.parse(init.body)).toEqual({ prompt: "a bar of chocolate", steps: 4 });
  });

  it("refuses to call anything when the credentials aren't set", async () => {
    vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "");
    await expect(generateFluxImage("x")).rejects.toMatchObject({ kind: "not_configured" });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("reports the daily free allowance being used up as a quota problem, not a failure", async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse(429, { success: false, errors: [{ code: 4006, message: "you have used up your daily free allocation of 10,000 neurons" }] })
    );
    const err = await generateFluxImage("x").catch((e) => e);
    expect(err).toBeInstanceOf(CloudflareImageError);
    expect(err.kind).toBe("quota");
    expect(err.message).toMatch(/allowance for today is used up/);
  });

  it("recognises the quota message even without a status or code", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(400, { success: false, errors: [{ message: "Free allocation exceeded" }] }));
    await expect(generateFluxImage("x")).rejects.toMatchObject({ kind: "quota" });
  });

  it("explains rejected credentials without echoing them", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(403, { success: false, errors: [{ message: "Authentication error" }] }));
    const err = await generateFluxImage("x").catch((e) => e);
    expect(err.message).toMatch(/rejected the credentials/);
    expect(err.message).not.toContain("tok-secret");
  });

  it("surfaces other failures with their status and message", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(500, { success: false, errors: [{ message: "model unavailable" }] }));
    await expect(generateFluxImage("x")).rejects.toThrow("AI photo generation failed (500): model unavailable");
  });

  it("treats a 200 without an image as a failure", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, result: {} }));
    await expect(generateFluxImage("x")).rejects.toThrow(/failed/);
  });

  it("turns a network error into a readable message", async () => {
    mockedFetch.mockRejectedValue(new Error("socket hang up"));
    await expect(generateFluxImage("x")).rejects.toThrow("Could not reach the AI photo service: socket hang up");
  });

  it("gives up when the service takes too long", async () => {
    mockedFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        })
    );
    await expect(generateFluxImage("x", { timeoutMs: 10 })).rejects.toThrow("took too long");
  });

  it("trims an over-long prompt to the model's limit", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, result: { image: IMAGE_B64 } }));
    await generateFluxImage("p".repeat(5000));
    expect(JSON.parse(mockedFetch.mock.calls[0][1].body).prompt).toHaveLength(2048);
  });
});
